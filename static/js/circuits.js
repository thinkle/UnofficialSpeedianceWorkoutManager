(function () {
    'use strict';

    function exerciseSignature(ex) {
        return String(ex.groupId);
    }

    function cloneExercise(exercise) {
        if (typeof structuredClone === 'function') {
            return structuredClone(exercise);
        }
        return JSON.parse(JSON.stringify(exercise));
    }

    function segmentMatches(signatures, startA, startB, len) {
        for (let i = 0; i < len; i += 1) {
            if (signatures[startA + i] !== signatures[startB + i]) return false;
        }
        return true;
    }

    function detectCircuitAtIndex(data, startIndex, maxCycle) {
        const signatures = data.map(exerciseSignature);
        const remaining = data.length - startIndex;
        const maxLen = Math.min(maxCycle, Math.floor(remaining / 2));
        for (let cycleLen = 2; cycleLen <= maxLen; cycleLen += 1) {
            const cycleSignatures = signatures.slice(startIndex, startIndex + cycleLen);
            const distinct = new Set(cycleSignatures);
            if (distinct.size < 2) {
                continue;
            }
            if (!segmentMatches(signatures, startIndex, startIndex + cycleLen, cycleLen)) {
                continue;
            }
            let rounds = 2;
            while (startIndex + (rounds + 1) * cycleLen <= data.length) {
                if (!segmentMatches(signatures, startIndex, startIndex + rounds * cycleLen, cycleLen)) {
                    break;
                }
                rounds += 1;
            }
            return { cycleLen, rounds, length: cycleLen * rounds };
        }
        return null;
    }

    function buildCondensedBlocks(data, maxCycle = 8) {
        const blocks = [];
        let i = 0;
        while (i < data.length) {
            const detected = detectCircuitAtIndex(data, i, maxCycle);
            if (detected) {
                blocks.push({ type: 'circuit', start: i, ...detected });
                i += detected.length;
                continue;
            }
            blocks.push({ type: 'single', index: i });
            i += 1;
        }
        return blocks;
    }

    function buildCircuitExercises(workout, start, cycleLen, rounds) {
        const exercises = [];
        for (let order = 0; order < cycleLen; order += 1) {
            const entries = [];
            for (let round = 0; round < rounds; round += 1) {
                const idx = start + round * cycleLen + order;
                entries.push(workout[idx]);
            }
            exercises.push(entries);
        }
        return exercises;
    }

    function parseWorkoutBlocks(workout, maxCycle = 8) {
        const blocks = [];
        let i = 0;
        while (i < workout.length) {
            const detected = detectCircuitAtIndex(workout, i, maxCycle);
            if (detected) {
                const exercises = buildCircuitExercises(workout, i, detected.cycleLen, detected.rounds);
                blocks.push({
                    type: 'circuit',
                    start: i,
                    cycleLen: detected.cycleLen,
                    rounds: detected.rounds,
                    length: detected.length,
                    exercises,
                });
                i += detected.length;
                continue;
            }
            blocks.push({ type: 'single', exercise: workout[i] });
            i += 1;
        }
        return blocks;
    }

    function flattenCircuitExercises(exercises) {
        if (!exercises.length) return [];
        const rounds = exercises[0].length;
        const cycleLen = exercises.length;
        const flattened = [];
        for (let round = 0; round < rounds; round += 1) {
            for (let order = 0; order < cycleLen; order += 1) {
                flattened.push(exercises[order][round]);
            }
        }
        return flattened;
    }

    function flattenBlocks(blocks) {
        const workout = [];
        blocks.forEach(block => {
            if (block.type === 'circuit') {
                workout.push(...flattenCircuitExercises(block.exercises));
            } else if (block.type === 'single') {
                workout.push(block.exercise);
            }
        });
        return workout;
    }

    function workoutToCircuits(workout) {
        const blocks = parseWorkoutBlocks(workout);
        return blocks.map(block => {
            if (block.type === 'circuit') {
                return { type: 'circuit', exercises: block.exercises };
            }
            return block.exercise;
        });
    }

    function appendOntoCircuit(workout, circuitIndex, exercise) {
        const blocks = parseWorkoutBlocks(workout);
        const block = blocks[circuitIndex];
        if (!block || block.type !== 'circuit') return workout.slice();
        const rounds = block.exercises[0]?.length || 0;
        const appended = block.exercises.slice();
        const newColumn = [];
        for (let round = 0; round < rounds; round += 1) {
            newColumn.push(cloneExercise(exercise));
        }
        appended.push(newColumn);
        block.exercises = appended;
        return flattenBlocks(blocks);
    }

    function deleteSetFromCircuit(workout, circuitIndex, itemIndex) {
        const blocks = parseWorkoutBlocks(workout);
        const block = blocks[circuitIndex];
        if (!block || block.type !== 'circuit') return workout.slice();
        const roundIndex = itemIndex;
        const trimmed = block.exercises.map(group => {
            const next = group.slice();
            if (roundIndex >= 0 && roundIndex < next.length) {
                next.splice(roundIndex, 1);
            }
            return next;
        });
        const hasAny = trimmed.some(group => group.length > 0);
        if (!hasAny) {
            blocks.splice(circuitIndex, 1);
        } else {
            block.exercises = trimmed;
        }
        return flattenBlocks(blocks);
    }

    function appendSetToCircuit(workout, circuitIndex) {
        const blocks = parseWorkoutBlocks(workout);
        const block = blocks[circuitIndex];
        if (!block || block.type !== 'circuit') return workout.slice();
        const next = block.exercises.map(group => {
            const cloneSource = group[group.length - 1];
            const clone = cloneSource ? cloneExercise(cloneSource) : null;
            return clone ? group.concat([clone]) : group.slice();
        });
        block.exercises = next;
        return flattenBlocks(blocks);
    }

    function deleteExerciseFromCircuit(workout, circuitIndex, exerciseIndex) {
        const blocks = parseWorkoutBlocks(workout);
        const block = blocks[circuitIndex];
        if (!block || block.type !== 'circuit') return workout.slice();
        if (exerciseIndex < 0 || exerciseIndex >= block.exercises.length) return workout.slice();
        const trimmed = block.exercises.slice();
        trimmed.splice(exerciseIndex, 1);
        if (trimmed.length === 0) {
            blocks.splice(circuitIndex, 1);
        } else {
            block.exercises = trimmed;
        }
        return flattenBlocks(blocks);
    }

    function moveCircuit(workout, fromIndex, toIndex) {
        const blocks = parseWorkoutBlocks(workout);
        if (fromIndex < 0 || fromIndex >= blocks.length) return workout.slice();
        const clamped = Math.max(0, Math.min(toIndex, blocks.length - 1));
        const [moved] = blocks.splice(fromIndex, 1);
        blocks.splice(clamped, 0, moved);
        return flattenBlocks(blocks);
    }

    function reorderCircuitItems(workout, circuitIndex, fromPos, toPos) {
        const blocks = parseWorkoutBlocks(workout);
        const block = blocks[circuitIndex];
        if (!block || block.type !== 'circuit') return workout.slice();
        if (fromPos < 0 || fromPos >= block.exercises.length) return workout.slice();
        if (toPos < 0 || toPos >= block.exercises.length) return workout.slice();
        const reordered = block.exercises.slice();
        const [moved] = reordered.splice(fromPos, 1);
        reordered.splice(toPos, 0, moved);
        block.exercises = reordered;
        return flattenBlocks(blocks);
    }

    const Circuits = {
        exerciseSignature,
        segmentMatches,
        detectCircuitAtIndex,
        buildCondensedBlocks,
        workoutToCircuits,
        appendOntoCircuit,
        deleteSetFromCircuit,
        appendSetToCircuit,
        deleteExerciseFromCircuit,
        moveCircuit,
        reorderCircuitItems,
    };

    window.Circuits = Circuits;
    window.exerciseSignature = exerciseSignature;
    window.segmentMatches = segmentMatches;
    window.detectCircuitAtIndex = detectCircuitAtIndex;
    window.buildCondensedBlocks = buildCondensedBlocks;
    window.workoutToCircuits = workoutToCircuits;
    window.appendOntoCircuit = appendOntoCircuit;
    window.appendExerciseToCircuit = appendOntoCircuit;
    window.deleteSetFromCircuit = deleteSetFromCircuit;
    window.appendSetToCircuit = appendSetToCircuit;
    window.deleteExerciseFromCircuit = deleteExerciseFromCircuit;
    window.moveCircuit = moveCircuit;
    window.reorderCircuitItems = reorderCircuitItems;
})();
