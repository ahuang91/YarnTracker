// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Plus, ArrowLeft, ChevronRight, List, Trash2 } from 'lucide-react';
import { storage } from '../lib/storage';

const YarnTracker = () => {
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [activeProject, setActiveProject] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionStartRow, setSessionStartRow] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLoadErrorDialog, setShowLoadErrorDialog] = useState(false);
  const [showSessionSavedDialog, setShowSessionSavedDialog] = useState(false);
  const [showDuplicateNameDialog, setShowDuplicateNameDialog] = useState(false);
  const [showEmptyFieldsDialog, setShowEmptyFieldsDialog] = useState(false);
  const [showProjectCompleteDialog, setShowProjectCompleteDialog] = useState(false);
  const [lastSessionInfo, setLastSessionInfo] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [sessionRowsWorked, setSessionRowsWorked] = useState(0);
  const [pausedAt, setPausedAt] = useState(null);
  const [wasPausedBeforeExit, setWasPausedBeforeExit] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    pattern: '',
    startingRow: '',
    existingTimeHours: 0,
    existingTimeMinutes: 0
  });
  const currentRowRef = useRef(null);

  // Load projects from storage
  useEffect(() => {
    loadProjectsFromStorage();
  }, []);

  const loadProjectsFromStorage = async () => {
    console.log('Starting to load projects...');
    setIsLoadingProjects(true);
    setShowLoadErrorDialog(false);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => {
          console.log('Load timeout!');
          reject(new Error('Timeout'));
        }, 5000)
      );
      
      const loadPromise = storage.list('project:');
      
      const result = await Promise.race([loadPromise, timeoutPromise]);
      
      console.log('Load result:', result);
      
      if (result && result.keys && result.keys.length > 0) {
        const loadedProjects = await Promise.all(
          result.keys.map(async (key) => {
            try {
              const data = await storage.get(key);
              if (data && data.value) {
                const project = JSON.parse(data.value);
                
                // Migration: Fix projects that should start at Cast on
                if (project.currentRow === 0 && project.rows && project.rows.length > 0) {
                  const firstNumberedRowIndex = project.rows.findIndex(r => r.number !== null);
                  if (firstNumberedRowIndex > 0) {
                    // There are non-numbered instructions before first row, should start at -1
                    project.currentRow = -1;
                    // Save the migrated project
                    await storage.set(key, JSON.stringify(project));
                  }
                }
                
                return project;
              }
              return null;
            } catch (err) {
              console.error(`Error loading project ${key}:`, err);
              return null;
            }
          })
        );
        setProjects(loadedProjects.filter(p => p !== null));
        console.log('Projects loaded successfully:', loadedProjects.length);
      } else {
        setProjects([]);
        console.log('No projects found');
      }
      setIsLoadingProjects(false);
      console.log('Loading complete, isLoadingProjects set to false');
    } catch (error) {
      console.error('Error loading projects:', error);
      setIsLoadingProjects(false);
      setShowLoadErrorDialog(true);
      console.log('Error dialog should be showing now');
    }
  };

  // Timer logic
  useEffect(() => {
    let interval;
    if (sessionStartTime && !isPaused) {
      interval = setInterval(() => {
        const elapsed = pausedAt ? pausedAt - sessionStartTime : Date.now() - sessionStartTime;
        setSessionElapsed(elapsed);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [sessionStartTime, isPaused, pausedAt]);

  // Auto-scroll to current row
  useEffect(() => {
    if (currentRowRef.current) {
      currentRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeProject?.currentRow]);

  const parsePattern = (patternText) => {
    const lines = patternText.split('\n').filter(line => line.trim());
    const rows = [];
    const repeatSections = [];

    lines.forEach((line, idx) => {
      // Check for range format like "Rows 1-8 (bottom border): instruction"
      const rangeMatch = line.match(/Rows?\s+(\d+)\s*-\s*(\d+)\s*(?:\([^)]+\))?\s*:\s*(.+)/i);
      
      if (rangeMatch) {
        const startRow = parseInt(rangeMatch[1]);
        const endRow = parseInt(rangeMatch[2]);
        const instruction = rangeMatch[3];
        
        // Create individual rows for each in the range
        for (let i = startRow; i <= endRow; i++) {
          rows.push({
            number: i,
            text: `Row ${i}: ${instruction}`,
            originalIndex: idx,
            isRepeatInstruction: false
          });
        }
      } else {
        const rowMatch = line.match(/Row\s+(\d+):\s*(.+)/i);
        if (rowMatch) {
          rows.push({
            number: parseInt(rowMatch[1]),
            text: line,
            originalIndex: idx,
            isRepeatInstruction: false
          });
        } else {
          // Check if this is a repeat instruction
          const repeatMatch = line.match(/repeat\s+rows?\s+(\d+)\s*-?\s*(?:to\s+)?(\d+)(?:\s+(.*?))?$/i);
          if (repeatMatch) {
            const start = parseInt(repeatMatch[1]);
            const end = parseInt(repeatMatch[2]);
            const restOfLine = repeatMatch[3] || '';
            
            // Determine if it's user-decided or specified repeats
            let repeatType = 'user-decided';
            let specifiedRepeats = null;
            
            // Check for "to complete" wording - indicates single repeat
            if (restOfLine.toLowerCase().includes('to complete')) {
              repeatType = 'specified';
              specifiedRepeats = 1;
            } 
            // Check for "until" wording - indicates user-decided
            else if (restOfLine.toLowerCase().includes('until')) {
              repeatType = 'user-decided';
            }
            // Check for explicit number like "four times" or "4 times"
            else {
              const timesMatch = restOfLine.match(/(\w+)\s+times?/i);
              if (timesMatch) {
                const numberWord = timesMatch[1].toLowerCase();
                const numberMap = {
                  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                };
                specifiedRepeats = numberMap[numberWord] || parseInt(numberWord);
                if (specifiedRepeats) {
                  repeatType = 'specified';
                }
              }
            }
            
            repeatSections.push({
              start,
              end,
              text: line,
              originalIndex: idx,
              repeatType,
              specifiedRepeats
            });
            
            rows.push({
              number: null,
              text: line,
              originalIndex: idx,
              isRepeatInstruction: true,
              repeatStart: start,
              repeatEnd: end,
              repeatType,
              specifiedRepeats
            });
          } else {
            // Keep all other instructions (cast on, cast off, etc.)
            rows.push({
              number: null,
              text: line,
              originalIndex: idx,
              isRepeatInstruction: false
            });
          }
        }
      }
    });

    return { rows, repeatSections };
  };

  const saveProject = async (project) => {
    try {
      await storage.set(`project:${project.id}`, JSON.stringify(project));
    } catch (error) {
      console.error('Error saving project:', error);
      // Don't throw - allow the UI to continue even if save fails
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const handleCreateProject = async () => {
    const { title, pattern, startingRow, existingTimeHours, existingTimeMinutes } = formData;

    if (!title || !pattern) {
      alert('Please fill in all required fields');
      return;
    }

    if (projects.some(p => p.title === title)) {
      alert('A project with this title already exists. Please choose a unique title.');
      return;
    }

    const { rows, repeatSections } = parsePattern(pattern);
    
    // Find the index of the row that matches the starting row number
    const rowNumbers = rows.filter(r => r.number !== null);
    const startingRowIndex = rowNumbers.findIndex(r => r.number === parseInt(startingRow));
    const actualStartingRow = startingRowIndex >= 0 ? startingRowIndex : 0;
    
    const newProject = {
      id: Date.now().toString(),
      title,
      patternText: pattern,
      rows,
      repeatSections,
      currentRow: actualStartingRow,
      totalTime: (parseInt(existingTimeHours) * 60 * 60 * 1000) + (parseInt(existingTimeMinutes) * 60 * 1000),
      sessions: [],
      activeRepeat: null
    };

    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    await saveProject(newProject);
    setActiveProject(newProject);
    setCurrentView('active');
    setFormData({ title: '', pattern: '', startingRow: 0, existingTimeHours: 0, existingTimeMinutes: 0 });
  };

  const handlePreviousRow = async () => {
    const project = { ...activeProject };
    const rowNumbers = project.rows.filter(r => r.number !== null);
    
    // Track if we made changes
    let changed = false;
    
    // If we're on the final instruction, go back to the last repeat or row
    if (project.onFinalInstruction !== null && project.onFinalInstruction !== undefined) {
      const lastRepeatIndex = project.rows.slice(0, project.onFinalInstruction).reverse().findIndex(r => r.isRepeatInstruction);
      
      if (lastRepeatIndex >= 0) {
        const actualIndex = project.onFinalInstruction - 1 - lastRepeatIndex;
        const lastRepeat = project.rows[actualIndex];
        
        if (lastRepeat && lastRepeat.repeatStart && lastRepeat.repeatEnd) {
          project.activeRepeat = {
            start: lastRepeat.repeatStart,
            end: lastRepeat.repeatEnd,
            text: lastRepeat.text,
            repeatType: lastRepeat.repeatType,
            specifiedRepeats: lastRepeat.specifiedRepeats
          };
          const endRowIndex = rowNumbers.findIndex(r => r.number === lastRepeat.repeatEnd);
          project.currentRow = endRowIndex;
          project.onFinalInstruction = null;
          
          if (lastRepeat.repeatType === 'specified' && lastRepeat.specifiedRepeats) {
            project.repeatsCompleted = lastRepeat.specifiedRepeats;
          } else {
            project.repeatsCompleted = 1;
          }
          changed = true;
        }
      } else {
        project.currentRow = rowNumbers.length - 1;
        project.onFinalInstruction = null;
        changed = true;
      }
    } else if (project.activeRepeat) {
      // We're in a repeat block
      const currentRowNum = rowNumbers[project.currentRow]?.number;
      
      if (currentRowNum === project.activeRepeat.start) {
        // At the start of repeat block
        if (project.repeatsCompleted > 1) {
          // Loop back to end of repeat and decrement counter
          const endRowIndex = rowNumbers.findIndex(r => r.number === project.activeRepeat.end);
          project.currentRow = endRowIndex;
          project.repeatsCompleted = project.repeatsCompleted - 1;
          changed = true;
        } else {
          // Exit repeat and go to previous instruction (counter is 1 or 0)
          const repeatInstructionIndex = project.rows.findIndex(r => 
            r.isRepeatInstruction && 
            r.repeatStart === project.activeRepeat.start &&
            r.repeatEnd === project.activeRepeat.end
          );
          
          if (repeatInstructionIndex > 0) {
            // Find the previous numbered row
            const previousRows = project.rows.slice(0, repeatInstructionIndex).reverse();
            const prevNumberedRowIndex = previousRows.findIndex(r => r.number !== null);
            
            if (prevNumberedRowIndex >= 0) {
              const prevRow = previousRows[prevNumberedRowIndex];
              project.currentRow = rowNumbers.findIndex(r => r.number === prevRow.number);
              project.activeRepeat = null;
              project.repeatsCompleted = 0;
              changed = true;
            }
          }
        }
      } else {
        // Just go back one row within the repeat
        project.currentRow--;
        changed = true;
      }
    } else if (project.currentRow === 0) {
      // At first numbered row, check if there's a Cast on instruction before it
      const firstNumberedRowIndex = project.rows.findIndex(r => r.number !== null);
      if (firstNumberedRowIndex > 0) {
        // There are instructions before the first numbered row
        project.currentRow = -1;
        changed = true;
      }
    } else if (project.currentRow === -1) {
      // Already at the first instruction, can't go back
      return;
    } else if (project.currentRow > 0) {
      project.currentRow--;
      changed = true;
    }
    
    if (changed) {
      setSessionRowsWorked(sessionRowsWorked - 1);
      setActiveProject(project);
      await saveProject(project);
    }
  };

  const handleStartRepeat = async (repeatSection) => {
    const project = { ...activeProject };
    const rowNumbers = project.rows.filter(r => r.number !== null);
    const startRowIndex = rowNumbers.findIndex(r => r.number === repeatSection.repeatStart);
    
    if (startRowIndex >= 0) {
      project.currentRow = startRowIndex;
      project.activeRepeat = {
        start: repeatSection.repeatStart,
        end: repeatSection.repeatEnd,
        text: repeatSection.text,
        repeatType: repeatSection.repeatType,
        specifiedRepeats: repeatSection.specifiedRepeats
      };
      project.repeatsCompleted = 1; // Start at 1 since we just completed the section once
      setActiveProject(project);
      await saveProject(project);
    }
  };

  const handleRepeatAgain = async () => {
    const project = { ...activeProject };
    const rowNumbers = project.rows.filter(r => r.number !== null);
    const startRowIndex = rowNumbers.findIndex(r => r.number === project.activeRepeat.start);
    
    if (startRowIndex >= 0) {
      project.currentRow = startRowIndex;
      project.repeatsCompleted = (project.repeatsCompleted || 0) + 1;
      setActiveProject(project);
      await saveProject(project);
    }
  };

  const handleFinishRepeats = async () => {
    const project = { ...activeProject };
    const rowNumbers = project.rows.filter(r => r.number !== null);
    
    // Find the next instruction or row after the current repeat block
    const currentRepeatInstructionIndex = project.rows.findIndex(row => 
      row.isRepeatInstruction && 
      row.repeatStart === project.activeRepeat.start &&
      row.repeatEnd === project.activeRepeat.end
    );
    
    project.activeRepeat = null;
    project.repeatsCompleted = 0;
    
    if (currentRepeatInstructionIndex >= 0) {
      // Look for the next item after this repeat instruction
      const remainingRows = project.rows.slice(currentRepeatInstructionIndex + 1);
      const nextNumberedRowIndex = remainingRows.findIndex(r => r.number !== null);
      const nextRepeatIndex = remainingRows.findIndex(r => r.isRepeatInstruction);
      
      // Check which comes first: a numbered row or another repeat instruction
      if (nextRepeatIndex >= 0 && (nextNumberedRowIndex < 0 || nextRepeatIndex < nextNumberedRowIndex)) {
        // Next is another repeat instruction - start that repeat
        const nextRepeat = remainingRows[nextRepeatIndex];
        project.activeRepeat = {
          start: nextRepeat.repeatStart,
          end: nextRepeat.repeatEnd,
          text: nextRepeat.text,
          repeatType: nextRepeat.repeatType,
          specifiedRepeats: nextRepeat.specifiedRepeats
        };
        const startRowIndex = rowNumbers.findIndex(r => r.number === nextRepeat.repeatStart);
        project.currentRow = startRowIndex;
        project.repeatsCompleted = 0;
      } else if (nextNumberedRowIndex >= 0) {
        // Move to the next numbered row
        const nextRow = remainingRows[nextNumberedRowIndex];
        const nextRowIndexInProject = rowNumbers.findIndex(r => r.number === nextRow.number);
        project.currentRow = nextRowIndexInProject;
      } else {
        // No more numbered rows - find cast off or final instruction
        const finalInstructionIndex = remainingRows.findIndex(r => 
          !r.number && !r.isRepeatInstruction
        );
        if (finalInstructionIndex >= 0) {
          project.onFinalInstruction = currentRepeatInstructionIndex + 1 + finalInstructionIndex;
        }
      }
    }
    
    setActiveProject(project);
    await saveProject(project);
  };

  const handleNextRow = async () => {
    const project = { ...activeProject };
    const rowNumbers = project.rows.filter(r => r.number !== null).map(r => r.number);
    const currentRowNum = rowNumbers[project.currentRow];

    // If we're at the end of an active repeat, loop back to the start
    if (project.activeRepeat && currentRowNum === project.activeRepeat.end) {
      const startRowIndex = rowNumbers.indexOf(project.activeRepeat.start);
      project.currentRow = startRowIndex;
    } else if (project.currentRow === -1) {
      // Moving from first instruction (Cast on) to first numbered row
      project.currentRow = 0;
    } else if (project.currentRow < rowNumbers.length - 1) {
      project.currentRow++;
    }

    setSessionRowsWorked(sessionRowsWorked + 1);
    setActiveProject(project);
    await saveProject(project);
  };

  const handleEndRepeat = async () => {
    const project = { ...activeProject };
    const rowNumbers = project.rows.filter(r => r.number !== null).map(r => r.number);
    const repeatEndIndex = rowNumbers.indexOf(project.repeatInfo.end);
    
    project.currentRow = repeatEndIndex + 1;
    project.inRepeat = false;

    setActiveProject(project);
    await saveProject(project);
  };

  const handleFinishProject = async () => {
    if (sessionStartTime) {
      await handleEndSession();
    }
    setShowProjectCompleteDialog(true);
  };

  const handleProjectCompleteDialogClose = () => {
    setShowProjectCompleteDialog(false);
    setCurrentView('home');
    setActiveProject(null);
  };

  const handleStartSession = () => {
    setSessionStartTime(Date.now());
    setSessionElapsed(0);
    setIsPaused(false);
    setPausedAt(null);
    setSessionStartRow(activeProject.currentRow);
    setSessionRowsWorked(0);
  };

  const handleTogglePlayPause = () => {
    if (!sessionStartTime) {
      // Start new session
      handleStartSession();
    } else if (isPaused) {
      // Resume from pause
      const pauseDuration = Date.now() - pausedAt;
      setSessionStartTime(sessionStartTime + pauseDuration);
      setPausedAt(null);
      setIsPaused(false);
    } else {
      // Pause
      setPausedAt(Date.now());
      setIsPaused(true);
    }
  };

  const handleDiscardSession = () => {
    setSessionStartTime(null);
    setSessionElapsed(0);
    setIsPaused(false);
    setPausedAt(null);
    setSessionStartRow(activeProject.currentRow);
    setSessionRowsWorked(0);
  };

  const handleEndSession = async () => {
    if (!sessionStartTime) return;
    
    const totalSessionTime = sessionElapsed;

    const session = {
      datetime: new Date().toISOString(),
      timeSpent: totalSessionTime,
      rowsCompleted: sessionRowsWorked
    };

    const project = {
      ...activeProject,
      totalTime: activeProject.totalTime + totalSessionTime,
      sessions: [...activeProject.sessions, session]
    };

    setProjects(projects.map(p => p.id === project.id ? project : p));
    await saveProject(project);
    setActiveProject(project);
    
    // Store session info for dialog
    setLastSessionInfo({
      time: totalSessionTime,
      rows: sessionRowsWorked
    });
    
    // Clear session state
    setSessionStartTime(null);
    setSessionElapsed(0);
    setIsPaused(false);
    setPausedAt(null);
    setSessionRowsWorked(0);
    
    // Show saved dialog
    setShowSessionSavedDialog(true);
  };

  const handleDeleteProject = (projectId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setProjectToDelete(projectId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (projectToDelete) {
      try {
        const updatedProjects = projects.filter(p => p.id !== projectToDelete);
        setProjects(updatedProjects);
        await storage.delete(`project:${projectToDelete}`);
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
    setShowDeleteDialog(false);
    setProjectToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setProjectToDelete(null);
  };

  const handleBackToProjects = () => {
    if (sessionStartTime && !isPaused) {
      // Only show dialog if there's an active, non-paused session
      setWasPausedBeforeExit(false);
      setPausedAt(Date.now());
      setIsPaused(true);
      setShowExitDialog(true);
    } else if (sessionStartTime && isPaused) {
      // Session is paused but still active
      setWasPausedBeforeExit(true);
      setShowExitDialog(true);
    } else {
      // No active session, just go back
      setCurrentView('home');
      setActiveProject(null);
    }
  };

  const handleExitConfirm = async () => {
    await handleEndSession();
    setShowExitDialog(false);
    setCurrentView('home');
    setActiveProject(null);
    setWasPausedBeforeExit(false);
  };

  const handleExitCancel = () => {
    if (!wasPausedBeforeExit) {
      // Resume timer only if it wasn't paused before
      const pauseDuration = Date.now() - pausedAt;
      setSessionStartTime(sessionStartTime + pauseDuration);
      setPausedAt(null);
      setIsPaused(false);
    }
    setShowExitDialog(false);
    setWasPausedBeforeExit(false);
  };

  const handleLoadErrorRetry = () => {
    loadProjectsFromStorage();
  };

  const handleLoadErrorCancel = () => {
    setShowLoadErrorDialog(false);
    setProjects([]);
  };

  // Render views
  // Render load error dialog (independent of view)
  if (showLoadErrorDialog) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
          <h2 className="text-2xl font-bold text-purple-800 mb-4">Oops!</h2>
          <p className="text-gray-700 mb-6">
            We couldn't load your projects. This might be a temporary issue. Want to try again?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleLoadErrorCancel}
              className="flex-1 bg-gray-300 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-400 transition-all"
            >
              Nah
            </button>
            <button
              onClick={handleLoadErrorRetry}
              className="flex-1 bg-gradient-to-r from-purple-300 to-pink-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-400 hover:to-pink-400 transition-all"
            >
              Yeah!
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-purple-800 mb-8 text-center">
            My Yarn Projects
          </h1>
          
          <button
            onClick={() => setCurrentView('upload')}
            className="w-full mb-6 bg-gradient-to-r from-pink-300 to-purple-300 text-white px-6 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:from-pink-400 hover:to-purple-400 transition-all shadow-lg"
          >
            <Plus size={24} />
            Start New Project
          </button>

          {isLoadingProjects ? (
            <div className="text-center py-12">
              <div className="text-purple-600 text-lg">Loading your projects...</div>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg mb-2">No projects yet</div>
              <div className="text-gray-400">Click "Start New Project" to begin!</div>
            </div>
          ) : (
            <div className="space-y-4">
            {projects.map(project => {
              const rowNumbers = project.rows.filter(r => r.number !== null);
              let currentRowDisplay = 'Cast on';
              
              if (project.currentRow === -1) {
                currentRowDisplay = 'Cast on';
              } else if (project.onFinalInstruction !== null && project.onFinalInstruction !== undefined) {
                currentRowDisplay = 'Cast off';
              } else {
                currentRowDisplay = rowNumbers[project.currentRow]?.number || 0;
              }
              
              return (
                <div
                  key={project.id}
                  className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all border-2 border-pink-100 relative"
                >
                  <div 
                    onClick={() => {
                      setActiveProject(project);
                      setCurrentView('active');
                    }}
                    className="cursor-pointer"
                  >
                    <h2 className="text-2xl font-bold text-purple-700 mb-3">{project.title}</h2>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 text-sm">
                      <div className="bg-blue-50 rounded-xl p-2 sm:p-3">
                        <div className="text-blue-600 font-semibold text-xs sm:text-sm">Current Row</div>
                        <div className="text-xl sm:text-2xl font-bold text-blue-800">{currentRowDisplay}</div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-2 sm:p-3">
                        <div className="text-green-600 font-semibold text-xs sm:text-sm">Sessions</div>
                        <div className="text-xl sm:text-2xl font-bold text-green-800">{project.sessions.length}</div>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-2 sm:p-3">
                        <div className="text-purple-600 font-semibold text-xs sm:text-sm">Total Time</div>
                        <div className="text-base sm:text-lg font-bold text-purple-800">{formatTime(project.totalTime)}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    type="button"
                    className="absolute top-4 right-4 bg-red-400 hover:bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-semibold transition-all z-10"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          {showDeleteDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold text-purple-800 mb-4">Delete Project</h2>
                <p className="text-gray-700 mb-6">
                  Are you sure you want to delete this project? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelDelete}
                    className="flex-1 bg-gray-300 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-400 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="flex-1 bg-gradient-to-r from-red-400 to-pink-400 text-white px-6 py-3 rounded-xl font-semibold hover:from-red-500 hover:to-pink-500 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === 'upload') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-purple-50 p-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setCurrentView('home')}
            className="mb-6 flex items-center gap-2 text-purple-700 hover:text-purple-900"
          >
            <ArrowLeft size={20} />
            Back to Projects
          </button>

          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <h1 className="text-3xl font-bold text-purple-800 mb-6">Create New Project</h1>
            
            <div className="space-y-6">
              <div>
                <label className="block text-purple-700 font-semibold mb-2">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-pink-200 rounded-xl focus:border-purple-400 focus:outline-none"
                  placeholder="My cozy scarf"
                />
              </div>

              <div>
                <label className="block text-purple-700 font-semibold mb-2">
                  Pattern Instructions *
                </label>
                <textarea
                  value={formData.pattern}
                  onChange={(e) => setFormData({...formData, pattern: e.target.value})}
                  rows={12}
                  className="w-full px-4 py-3 border-2 border-pink-200 rounded-xl focus:border-purple-400 focus:outline-none font-mono text-sm"
                  placeholder="Cast on 20 stitches&#10;Row 1: Knit all&#10;Row 2: Purl all&#10;Repeat rows 1 to 2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-700 font-semibold mb-2">
                    Starting Row (optional)
                  </label>
                  <input
                    type="number"
                    value={formData.startingRow || ''}
                    onChange={(e) => setFormData({...formData, startingRow: e.target.value})}
                    min="1"
                    placeholder="Row number (e.g., 5)"
                    className="w-full px-4 py-3 border-2 border-pink-200 rounded-xl focus:border-purple-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-purple-700 font-semibold mb-2">
                    Time Already Spent (optional)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={formData.existingTimeHours}
                        onChange={(e) => setFormData({...formData, existingTimeHours: e.target.value})}
                        min="0"
                        placeholder="Hours"
                        className="w-full px-4 py-3 border-2 border-pink-200 rounded-xl focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        value={formData.existingTimeMinutes}
                        onChange={(e) => setFormData({...formData, existingTimeMinutes: e.target.value})}
                        min="0"
                        max="59"
                        placeholder="Minutes"
                        className="w-full px-4 py-3 border-2 border-pink-200 rounded-xl focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateProject}
                className="w-full bg-gradient-to-r from-pink-300 to-purple-300 text-white px-6 py-4 rounded-2xl font-semibold hover:from-pink-400 hover:to-purple-400 transition-all shadow-lg"
              >
                Create Project
              </button>
            </div>
          </div>

          {/* Duplicate Name Dialog */}
          {showDuplicateNameDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold text-purple-800 mb-4">Duplicate Name</h2>
                <p className="text-gray-700 mb-6">
                  A project with this title already exists. Please choose a unique title.
                </p>
                <button
                  onClick={() => setShowDuplicateNameDialog(false)}
                  className="w-full bg-gradient-to-r from-purple-300 to-pink-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-400 hover:to-pink-400 transition-all"
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* Empty Fields Dialog */}
          {showEmptyFieldsDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold text-purple-800 mb-4">Missing Information</h2>
                <p className="text-gray-700 mb-6">
                  Please fill in both the project title and pattern instructions.
                </p>
                <button
                  onClick={() => setShowEmptyFieldsDialog(false)}
                  className="w-full bg-gradient-to-r from-purple-300 to-pink-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-400 hover:to-pink-400 transition-all"
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === 'active' && activeProject) {
    console.log('Active project currentRow:', activeProject.currentRow);
    console.log('Active project rows:', activeProject.rows);
    
    const rowNumbers = activeProject.rows.filter(r => r.number !== null);
    const currentRowNum = activeProject.currentRow === -1 ? null : rowNumbers[activeProject.currentRow]?.number;
    
    // Check if we're on the final instruction (cast off)
    const isOnFinalInstruction = activeProject.onFinalInstruction !== null && activeProject.onFinalInstruction !== undefined;
    const isLastRow = !isOnFinalInstruction && activeProject.currentRow === rowNumbers.length - 1;
    
    // Find if there's a repeat instruction right after the current row
    let hasRepeatAfterCurrent = false;
    let nextRepeatItem = null;
    
    if (!isOnFinalInstruction && currentRowNum) {
      const currentRowIndex = activeProject.rows.findIndex(r => r.number === currentRowNum);
      if (currentRowIndex >= 0 && currentRowIndex < activeProject.rows.length - 1) {
        const nextItem = activeProject.rows[currentRowIndex + 1];
        if (nextItem?.isRepeatInstruction) {
          hasRepeatAfterCurrent = true;
          nextRepeatItem = nextItem;
        }
      }
    }
    
    // Check if we're at the end of an active repeat
    const isAtEndOfActiveRepeat = activeProject.activeRepeat && currentRowNum === activeProject.activeRepeat.end;
    
    // Check if we can repeat again or if we've hit the limit
    const canRepeatAgain = isAtEndOfActiveRepeat && (
      activeProject.activeRepeat.repeatType === 'user-decided' ||
      (activeProject.activeRepeat.repeatType === 'specified' && 
       (activeProject.repeatsCompleted || 0) + 1 < activeProject.activeRepeat.specifiedRepeats)
    );
    
    const mustFinishRepeat = isAtEndOfActiveRepeat && !canRepeatAgain;
    
    // Get the rows to display (filtered for active repeat)
    let displayRows = [];
    
    if (activeProject.activeRepeat) {
      // Show only rows in the active repeat range
      displayRows = activeProject.rows.filter(r => 
        r && r.number !== null && 
        r.number >= activeProject.activeRepeat.start && 
        r.number <= activeProject.activeRepeat.end
      );
    } else if (isOnFinalInstruction && activeProject.rows[activeProject.onFinalInstruction]) {
      // Show only the final instruction (cast off)
      displayRows = [activeProject.rows[activeProject.onFinalInstruction]];
    } else {
      // Show all rows (whether on Cast on or any numbered row)
      displayRows = activeProject.rows.filter(r => r && r.text);
    }

    return (
      <div className="h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-purple-50 px-3 sm:p-6 flex flex-col">
        <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0 py-4 sm:py-0">
          <button
            onClick={handleBackToProjects}
            className="mb-2 sm:mb-4 flex items-center gap-2 text-purple-700 hover:text-purple-900 shrink-0"
          >
            <ArrowLeft size={20} />
            Back to Projects
          </button>

          <h1 className="text-2xl sm:text-3xl font-bold text-purple-800 mb-2 sm:mb-4 shrink-0">{activeProject.title}</h1>

          {/* Timer Section */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg mb-3 sm:mb-6 overflow-hidden shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0">
                <div className="text-sm text-purple-600 font-semibold">Current Session</div>
                <div className="text-2xl sm:text-3xl font-bold text-purple-800">
                  {formatTime(sessionElapsed)}
                </div>
              </div>
              <div className="text-right min-w-0">
                <div className="text-sm text-blue-600 font-semibold">Total Time</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-800">
                  {formatTime(activeProject.totalTime + sessionElapsed)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={handleTogglePlayPause}
                className={`${
                  !sessionStartTime || isPaused
                    ? 'bg-green-400 hover:bg-green-500'
                    : 'bg-yellow-400 hover:bg-yellow-500'
                } text-white px-2 sm:px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all`}
              >
                {!sessionStartTime || isPaused ? <Play size={20} /> : <Pause size={20} />}
                <span className="hidden sm:inline">{!sessionStartTime || isPaused ? 'Start' : 'Pause'}</span>
              </button>
              <button
                onClick={handleEndSession}
                disabled={!sessionStartTime}
                className="bg-red-400 text-white px-2 sm:px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500 transition-all"
              >
                <Square size={20} />
                <span className="hidden sm:inline">End</span>
              </button>
              <button
                onClick={handleDiscardSession}
                disabled={!sessionStartTime}
                className="bg-gray-400 text-white px-2 sm:px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-500 transition-all"
              >
                <Trash2 size={20} />
                <span className="hidden sm:inline">Discard</span>
              </button>
            </div>
          </div>

          {/* Pattern Display */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg mb-3 sm:mb-6 flex-1 min-h-0 overflow-y-auto relative">
            {activeProject.activeRepeat && (
              <div className="bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-blue-300 rounded-xl p-4 mb-4 sticky top-0 z-10 shadow-md">
                <div className="text-sm font-semibold text-blue-800 mb-1">Active Repeat:</div>
                <div className="text-purple-900 font-bold mb-2">{activeProject.activeRepeat.text}</div>
                <div className="text-sm text-blue-700">
                  Repeats completed: <span className="font-bold">{activeProject.repeatsCompleted || 0}</span>
                  {activeProject.activeRepeat.repeatType === 'specified' && activeProject.activeRepeat.specifiedRepeats && (
                    <span> / {activeProject.activeRepeat.specifiedRepeats}</span>
                  )}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {displayRows && displayRows.length > 0 ? displayRows.map((row, idx) => {
                if (!row) return null;
                
                // Determine if this row is the current row
                let isCurrentRow = false;
                if (isOnFinalInstruction) {
                  isCurrentRow = idx === 0;
                } else if (activeProject.currentRow === -1) {
                  // Highlight Cast on (first non-numbered row)
                  isCurrentRow = row.number === null && idx === 0;
                } else {
                  // Highlight the current numbered row
                  isCurrentRow = row.number && rowNumbers[activeProject.currentRow]?.number === row.number;
                }
                
                return (
                  <div
                    key={row.originalIndex !== undefined ? row.originalIndex : `row-${idx}`}
                    ref={isCurrentRow ? currentRowRef : null}
                    className={`p-4 rounded-xl transition-all ${
                      isCurrentRow
                        ? 'bg-gradient-to-r from-pink-200 to-purple-200 font-bold text-purple-900 shadow-md'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    {row.text}
                  </div>
                );
              }) : (
                <div className="p-4 text-gray-500 text-center">No instructions to display</div>
              )}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-wrap gap-2 sm:gap-3 shrink-0 pb-1">
            <button
              onClick={handlePreviousRow}
              disabled={!sessionStartTime || isPaused || activeProject.currentRow === -1}
              className="flex-1 min-w-[120px] bg-gradient-to-r from-gray-300 to-gray-400 text-white px-3 sm:px-6 py-3 sm:py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:from-gray-400 hover:to-gray-500 transition-all shadow-lg text-sm sm:text-base"
            >
              <ChevronRight size={20} className="rotate-180" />
              Previous
            </button>

            {hasRepeatAfterCurrent && !activeProject.activeRepeat && (
              <button
                onClick={() => handleStartRepeat(nextRepeatItem)}
                disabled={!sessionStartTime || isPaused}
                className="flex-1 min-w-[120px] bg-gradient-to-r from-blue-300 to-green-300 text-white px-3 sm:px-6 py-3 sm:py-4 rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-400 hover:to-green-400 transition-all shadow-lg text-sm sm:text-base"
              >
                Start Repeat
              </button>
            )}

            {canRepeatAgain && (
              <button
                onClick={handleRepeatAgain}
                disabled={!sessionStartTime || isPaused}
                className="flex-1 min-w-[120px] bg-gradient-to-r from-green-300 to-blue-300 text-white px-3 sm:px-6 py-3 sm:py-4 rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-400 hover:to-blue-400 transition-all shadow-lg text-sm sm:text-base"
              >
                Repeat Again
              </button>
            )}

            {(mustFinishRepeat || (isAtEndOfActiveRepeat && canRepeatAgain)) && (
              <button
                onClick={handleFinishRepeats}
                disabled={!sessionStartTime || isPaused}
                className="flex-1 min-w-[120px] bg-gradient-to-r from-orange-300 to-red-300 text-white px-3 sm:px-6 py-3 sm:py-4 rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-orange-400 hover:to-red-400 transition-all shadow-lg text-sm sm:text-base"
              >
                Finish Repeats
              </button>
            )}

            {!hasRepeatAfterCurrent && !isAtEndOfActiveRepeat && (
              <button
                onClick={isOnFinalInstruction ? handleFinishProject : handleNextRow}
                disabled={!sessionStartTime || isPaused}
                className="flex-1 min-w-[120px] bg-gradient-to-r from-pink-300 to-purple-300 text-white px-3 sm:px-6 py-3 sm:py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:from-pink-400 hover:to-purple-400 transition-all shadow-lg text-sm sm:text-base"
              >
                {isOnFinalInstruction ? 'Finish Project 🎉' : 'Next Row'}
                {!isOnFinalInstruction && <ChevronRight size={20} />}
              </button>
            )}

            <button
              onClick={() => setShowHistory(!showHistory)}
              className="bg-blue-300 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-semibold hover:bg-blue-400 transition-all shadow-lg"
            >
              <List size={20} />
            </button>
          </div>

          {/* History Sidebar */}
          {showHistory && (
            <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl p-6 overflow-y-auto z-50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-purple-800">Session History</h2>
                <button onClick={() => setShowHistory(false)} className="text-purple-600 hover:text-purple-800 text-2xl">
                  ✕
                </button>
              </div>
              
              <div className="space-y-3">
                {[...activeProject.sessions].reverse().map((session, idx) => (
                  <div key={idx} className="bg-purple-50 rounded-xl p-4">
                    <div className="text-xs text-purple-600 mb-2">
                      {new Date(session.datetime).toLocaleString()}
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-semibold text-purple-800">
                          {session.rowsCompleted} rows
                        </div>
                      </div>
                      <div className="text-sm font-bold text-purple-700">
                        {formatTime(session.timeSpent)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Saved Dialog */}
          {showSessionSavedDialog && lastSessionInfo && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold text-purple-800 mb-4">Session Saved! 🎉</h2>
                <p className="text-gray-700 mb-2">
                  <span className="font-semibold">Time:</span> {formatTime(lastSessionInfo.time)}
                </p>
                <p className="text-gray-700 mb-6">
                  <span className="font-semibold">Rows completed:</span> {lastSessionInfo.rows}
                </p>
                <button
                  onClick={() => setShowSessionSavedDialog(false)}
                  className="w-full bg-gradient-to-r from-purple-300 to-pink-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-400 hover:to-pink-400 transition-all"
                >
                  Nice!
                </button>
              </div>
            </div>
          )}

          {/* Project Complete Dialog */}
          {showProjectCompleteDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold text-purple-800 mb-4">Project Complete! 🎉</h2>
                <p className="text-gray-700 mb-6">
                  Congratulations on finishing your project!
                </p>
                <button
                  onClick={handleProjectCompleteDialogClose}
                  className="w-full bg-gradient-to-r from-purple-300 to-pink-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-400 hover:to-pink-400 transition-all"
                >
                  Yay!
                </button>
              </div>
            </div>
          )}

          {/* Exit Dialog */}
          {showExitDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold text-purple-800 mb-4">Active Session</h2>
                <p className="text-gray-700 mb-6">
                  You are currently in an active working session. Leaving this page will end the session.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleExitConfirm}
                    className="flex-1 bg-gradient-to-r from-purple-300 to-pink-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-400 hover:to-pink-400 transition-all"
                  >
                    I'm Done
                  </button>
                  <button
                    onClick={handleExitCancel}
                    className="flex-1 bg-gradient-to-r from-green-300 to-blue-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-400 hover:to-blue-400 transition-all"
                  >
                    Keep Crafting
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default YarnTracker;