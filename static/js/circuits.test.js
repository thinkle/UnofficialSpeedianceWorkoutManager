
/* For our purposes we only care about groupId which is used to identify different exercises */
/* Circuit type is...
*
*  {
*     type: 'circuit',
*     exercises : Exercise[][], // array of arrays of exercises where each array is ONE groupId cycle
*     // So essentially, if the original workout is:
*     // [A, B, C, A, B, C, A, B, C]
*     // Then the circuit structure is just...
*     // [ type : 'circuit',
*     //   exercises: [A,A,A], [B,B,B], [C,C,C] ]
*     // but of course those objects are full exercise objects not just groupIds
*  }
*/

const cycleTwoThreeFourFive = [
    1, 2, 1, 2,
    1, 3, 1, 3, 1, 3,
    1, 4, 1, 4, 1, 4, 1, 4,
    1, 5, 1, 5, 1, 5, 1, 5, 1, 5
].map(
    (num) => ({ groupId: String.fromCharCode(64 + num) })
);

const cycleThree = [1, 2, 3, 1, 2, 3, 1, 2, 3, 4, 5, 6, 4, 5, 6, 4, 5, 6, 7, 8, 9, 7, 8, 9, 7, 8, 9].map(
    (num) => ({ groupId: String.fromCharCode(64 + num) })
);

const cycleFour = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4,
    5, 6, 7, 8, 5, 6, 7, 8, 5, 6, 7, 8, 5, 6, 7, 8,
    9, 10, 11, 12, 9, 10, 11, 12, 9, 10, 11, 12, 9, 10, 11, 12,
    13, 14, 15, 16, 13, 14, 15, 16, 13, 14, 15, 16, 13, 14, 15, 16,
].map(
    (num) => ({ groupId: String.fromCharCode(64 + num) })
);

const sandwichCycles = [
    1, 2, 3,
    1, 2, 3, // cycle 1
    4, 5, 6, // 2, 3, 4 
    7, 8, 9, // 5, 6, 7
    10, 11, 12,  // 8, 9, 10
    1, // 11
    2, 7, 3, // cycle 2  - 12
    2, 7, 3
].map(
    (num) => ({ groupId: String.fromCharCode(64 + num) })
);

const fullExerciseExample = [{
    groupId: 'A', otherProp: 'foo', zigglethorp: 7,
},
{
    groupId: 'B', otherProp: 'bar', reps: 14
},
{
    groupId: 'A', otherProp: 'baz',
},
{ groupId: 'B', otherProp: 'qux', }
];

(function () {
    'use strict';

    function assertFalse(value, label) {
        if (value) {
            throw new Error(label + ': expected false, got ' + value);
        }
    }

    function assertEqual(actual, expected, label) {
        if (actual !== expected) {
            throw new Error(label + ': expected ' + expected + ', got ' + actual);
        }
    }

    function assertDeepEqual(actual, expected, label) {
        const a = JSON.stringify(actual);
        const e = JSON.stringify(expected);
        if (a !== e) {
            throw new Error(label + ': expected ' + e + ', got ' + a);
        }
    }

    function describeParsed(parsed) {
        return parsed.map(item => {
            if (item && item.type === 'circuit') {
                const rounds = item.exercises[0]?.length || 0;
                const cycleLen = item.exercises.length;
                const groupIds = item.exercises.map(group => group.map(ex => ex.groupId));
                return { type: 'circuit', cycleLen, rounds, groupIds };
            }
            return { type: 'single', groupId: item?.groupId };
        });
    }

    function summarizeWorkout(workout) {
        return workout.map(ex => ex.groupId);
    }

    function testCircuitParsing() {
        let parsed = window.workoutToCircuits(cycleTwoThreeFourFive);
        try {
            assertEqual(parsed.length, 4, 'cycleTwoThreeFourFive - number of circuits');
            assertEqual(parsed[0].exercises[0].length, 2, 'cycleTwoThreeFourFive - circuit 1 length');
            assertEqual(parsed[1].exercises[0].length, 3, 'cycleTwoThreeFourFive - circuit 2 length');
            assertEqual(parsed[2].exercises[0].length, 4, 'cycleTwoThreeFourFive - circuit 3 length');
            assertEqual(parsed[3].exercises[0].length, 5, 'cycleTwoThreeFourFive - circuit 4 length');
        } catch (err) {
            console.error('[circuits.test] testCircuitParsing failure', {
                workout: summarizeWorkout(cycleTwoThreeFourFive),
                parsed: parsed,
            });
            throw err;
        }
        // Let's make sure the structure is correct
        assertEqual(parsed[0].type, 'circuit', 'cycleTwoThreeFourFive - circuit 1 type');
        assertEqual(parsed[0].exercises[0][0].groupId, cycleTwoThreeFourFive[0].groupId, 'cycleTwoThreeFourFive - circuit 1 first exercise groupId');
        assertEqual(parsed[0].exercises[1][0].groupId, cycleTwoThreeFourFive[1].groupId, 'cycleTwoThreeFourFive - circuit 2 second exercise groupId');
        for (let i = 0; i < parsed.length; i++) {
            // Each of these circuits contains only two exercises: A and the cycle exercise
            const circuit = parsed[i];
            assertEqual(parsed[i].exercises.length, 2, `cycleTwoThreeFourFive - circuit ${i + 1} number of exercise types`);
        }
        parsed = window.workoutToCircuits(cycleThree);
        assertEqual(parsed.length, 3, 'cycleThree - number of circuits');
        assertEqual(parsed[0].type, 'circuit', 'cycleThree - circuit 1 type');
        assertEqual(parsed[0].exercises[0].length, 3, 'cycleThree - circuit 1 length');
        assertEqual(parsed[1].type, 'circuit', 'cycleThree - circuit 2 type');
        assertEqual(parsed[1].exercises[0].length, 3, 'cycleThree - circuit 2 length');
        assertEqual(parsed[2].type, 'circuit', 'cycleThree - circuit 3 type');
        assertEqual(parsed[2].exercises[0].length, 3, 'cycleThree - circuit 3 length');
        parsed = window.workoutToCircuits(cycleFour);
        assertEqual(parsed.length, 4, 'cycleFour - number of circuits');
        assertEqual(parsed[0].exercises[0].length, 4, 'cycleFour - circuit 1 length');
        assertEqual(parsed[1].exercises[0].length, 4, 'cycleFour - circuit 2 length');
        assertEqual(parsed[2].exercises[0].length, 4, 'cycleFour - circuit 3 length');
        assertEqual(parsed[3].exercises[0].length, 4, 'cycleFour - circuit 4 length');
        parsed = window.workoutToCircuits(sandwichCycles);
        assertEqual(parsed.length, 12, 'sandwichCycles - number of circuits');
        assertEqual(parsed[0].exercises[0].length, 2, 'sandwichCycles - circuit 1 length');
        // We expect the second parsed item to be NOT a circuit in sandwich
        assertFalse(parsed[1].type === 'circuit', 'sandwichCycles - circuit 2 is not a circuit');
        assertEqual(parsed[11].exercises[0].length, 2, 'sandwichCycles - circuit 12 length is 2');
        // Make sure we copy actual objects over not just groupIds...
        parsed = window.workoutToCircuits(fullExerciseExample);
        assertEqual(parsed.length, 1, 'fullExerciseExample - number of circuits');
        assertEqual(parsed[0].type, 'circuit', 'fullExerciseExample - circuit type');
        assertEqual(parsed[0].exercises.length, 2, 'fullExerciseExample - number of exercise types in circuit');
        assertEqual(parsed[0].exercises[0].length, 2, 'fullExerciseExample - number of rounds in exercise type 1');
        assertEqual(parsed[0].exercises[1].length, 2, 'fullExerciseExample - number of rounds in exercise type 2');
        // Check that other properties are preserved...
        assertEqual(parsed[0].exercises[0][0].otherProp, 'foo', 'fullExerciseExample - exercise 1 otherProp preserved');
        assertEqual(parsed[0].exercises[0][1].otherProp, 'baz', 'fullExerciseExample - exercise 3 otherProp preserved');
        assertEqual(parsed[0].exercises[1][0].otherProp, 'bar', 'fullExerciseExample - exercise 2 otherProp preserved');
        assertEqual(parsed[0].exercises[1][0].reps, 14, 'fullExerciseExample - exercise 2 reps preserved');
        assertEqual(parsed[0].exercises[1][1].otherProp, 'qux', 'fullExerciseExample - exercise 4 otherProp preserved');
    }

    function testCircuitDeletion() {
        let circuits = cycleThree.slice(); // copy cycle 3!
        let updatedCircuits = window.deleteSetFromCircuit(
            circuits,
            1, // circuit index
            1  // item index
        );
        // Now we expect the each set  circuit to have only two items
        let parsed = window.workoutToCircuits(updatedCircuits);
        assertEqual(parsed.length, 3, 'deleteSetFromCircuit - number of circuits after deletion should be unchanged');
        assertEqual(parsed[0].exercises[0].length, 3, 'deleteSetFromCircuit - circuit 1 length unchanged after deletion from circuit 2');
        assertEqual(parsed[1].exercises[0].length, 2, 'deleteSetFromCircuit - circuit 2 length after deletion');
        assertEqual(parsed[2].exercises[0].length, 3, 'deleteSetFromCircuit - circuit 3 length unchanged after deletion from circuit 2');
    }

    function testCircuitInsertion() {
        for (let ci = 0; ci < 3; ci++) {
            let circuits = cycleThree.slice(); // copy cycle 3!
            circuits = appendOntoCircuit(circuits, ci, { groupId: 'Z' });
            // Now we expect each the first circuit to have four items
            let parsed = window.workoutToCircuits(circuits);
            try {
                assertEqual(parsed.length, 3, 'insertIntoCircuit - number of circuits after insertion should be unchanged');
                assertEqual(parsed[ci].exercises.length, 4, `insertIntoCircuit - circuit ${ci + 1} now has 4 items`);
                // Make sure each of the items has three exercises
                for (let i = 0; i < parsed[ci].exercises.length; i++) {
                    assertEqual(parsed[ci].exercises[i].length, 3, `insertIntoCircuit - circuit ${ci + 1} item ${i} has 4 exercises`);
                }
            } catch (err) {
                console.error('[circuits.test] testCircuitInsertion failure', {
                    circuitIndex: ci,
                    workout: summarizeWorkout(circuits),
                    parsed: parsed,
                });
                throw err;
            }
        }
    }

    function testMoveCircuits() {
        let workout = cycleTwoThreeFourFive.slice(); // copy 2/3/4/5 length circuits...
        workout = window.moveCircuit(workout, 0, 2); // Move first circuit to the second index...
        // We expect now...
        // 1,3,1,3,1,3 (length 3)
        // 1,4,1,4,1,4,1,4 (length 4)
        // 1,2,1,2 (length 2)
        // 1,5,1,5,1,5,1,5,1,5 (length 5)
        try {
            assertEqual(workout[1].groupId, 'C', 'moveCircuit - first item in first circuit is now C');
            assertEqual(workout[15].groupId, 'B', 'moveCircuit - first item in second circuit is now B');
        } catch (err) {
            console.error('[circuits.test] testMoveCircuits failure', {
                workout: summarizeWorkout(workout),
            });
            throw err;
        }
        let parsed = window.workoutToCircuits(workout); // parse our workout...        
        try {
            assertEqual(parsed.length, 4, 'moveCircuit - number of circuits after move should be unchanged');
            assertEqual(parsed[0].exercises[0].length, 3, 'moveCircuit - first circuit is now length 3');
            assertEqual(parsed[1].exercises[0].length, 4, 'moveCircuit - second circuit is now length 4');
            assertEqual(parsed[2].exercises[0].length, 2, 'moveCircuit - third circuit is now length 2');
        } catch (err) {
            console.error('[circuits.test] testMoveCircuits failure', {
                workout: summarizeWorkout(workout),
                parsed
            });
            throw err;
        }
        // Now test moving circuits in a "mixed" workout
        workout = sandwichCycles.slice(); // copy sandwich cycles...        
        let originalParsed = window.workoutToCircuits(workout);
        workout = window.moveCircuit(workout, 0, 5); // Move first circuit to the sixth index...
        parsed = window.workoutToCircuits(workout); // parse our workout...        
        try {
            assertEqual(parsed.length, originalParsed.length, 'moveCircuit (mixed) - number of circuits after move should be unchanged');
            assertEqual(parsed[5].exercises[0].length, 2, 'moveCircuit (mixed) - sixth circuit is now length 2');
            // And our first item should now be a standalone exercise A            
            assertEqual(parsed[0].groupId, sandwichCycles[6].groupId, 'moveCircuit (mixed) - first item is now former 6th item');
            assertFalse(parsed[0].type === 'circuit', 'moveCircuit (mixed) - first item is not a circuit');
        } catch (err) {
            console.error('[circuits.test] testMoveCircuits (mixed) failure', {
                workout: summarizeWorkout(workout),
                originalWorkout: sandwichCycles,
                parsed,
                originalParsed,
            });
            throw err;
        }
        // Finally... moving a circuit should allow creating a new circuit where none existed before
        workout = ['A', 'B', 'C', 'D', 'C', 'D', 'A', 'B'].map((gid) => ({ groupId: gid }));
        // Our parsed structure is:
        // A - 0, 
        // B, 1
        // (Circuit C-D), 2
        // A, 3
        // B, 4                
        originalParsed = window.workoutToCircuits(workout);
        try {
            assertEqual(originalParsed.length, 5, 'moveCircuit (create new) - original number of circuits/items');
        } catch (err) {
            console.error('[circuits.test] testMoveCircuits (create new) failure', {
                workout,
                parsed: originalParsed,
            });
            throw err;
        }
        workout = window.moveCircuit(workout, 2, 4); // move first circuit to the end...
        parsed = window.workoutToCircuits(workout);
        try {
            assertEqual(parsed.length, 2, 'moveCircuit (create new) - number of circuits/items after move should be 2');
            assertEqual(parsed[0].type, 'circuit', 'moveCircuit (create new) - first item is now a circuit');
            assertEqual(parsed[0].exercises[0].length, 2, 'moveCircuit (create new) - first circuit has 2 items');
            assertEqual(parsed[0].exercises[0][0].groupId, 'A', 'moveCircuit (create new) - first circuit first item is A');
        } catch (err) {
            console.error('[circuits.test] testMoveCircuits (create new) failure', {
                workout: summarizeWorkout(workout),
                originalWorkout: ['A', 'B', 'C', 'D', 'C', 'D', 'A', 'B'],
                parsed,
                originalParsed,
            });
            throw err;
        }
    }

    function testCircuitReordering() {
        let workout = cycleThree.slice(); // copy cycle 3!
        workout = reorderCircuitItems(workout, 0, 2, 0); // Move index 2 (third) to index 0 (first) in first circuit
        try {
            for (let i of [0, 3, 6]) {
                assertEqual(workout[i].groupId, cycleThree[2].groupId, 'reorderCircuitItems - first item in first circuit is now C');
            }
            for (let i of [2, 5, 8]) {
                assertEqual(workout[i].groupId, cycleThree[1].groupId, 'reorderCircuitItems - last item in first circuit is now B');
            }
            assertEqual(workout[9].groupId, cycleThree[9].groupId, 'reorderCircuitItems - first item in second circuit is unchanged');
        } catch (err) {
            console.error('[circuits.test] testCircuitReordering failure (we were suppsoed to swap items 1 and 3 in the first circuit', {
                workout: workout,
            });
            throw err;
        }
        let parsed = window.workoutToCircuits(workout);
        assertEqual(parsed.length, 3, 'reorderCircuitItems - number of circuits after reordering should be unchanged');
        assertEqual(parsed[0].exercises.length, 3, 'reorderCircuitItems - first circuit number of items unchanged after reordering');
        assertEqual(parsed[1].exercises.length, 3, 'reorderCircuitItems - second circuit number of items unchanged after reordering');
        assertEqual(parsed[2].exercises.length, 3, 'reorderCircuitItems - third circuit number of items unchanged after reordering');

        workout = cycleThree.slice(); // copy cycle 3!
        workout = reorderCircuitItems(workout, 1, 1, 2);  // Move index 1 (second) to index 2 (third) in second circuit
        try {
            for (let i of [9, 12, 15]) {
                assertEqual(workout[i].groupId, cycleThree[9].groupId, 'reorderCircuitItems - first item in second circuit is unchanged');
            }
            for (let i of [10, 13, 16]) {
                assertEqual(workout[i].groupId, cycleThree[11].groupId, 'reorderCircuitItems - middle and last item in second circuit swapped');
            }
            for (let i of [11, 14, 17]) {
                assertEqual(workout[i].groupId, cycleThree[10].groupId, 'reorderCircuitItems - middle item in second circuit is now last');
            }
            assertEqual(workout[0].groupId, cycleThree[0].groupId, 'reorderCircuitItems - first item in first circuit is unchanged');

            let parsed = window.workoutToCircuits(workout);
            assertEqual(parsed.length, 3, 'reorderCircuitItems - number of circuits after reordering should be unchanged');
            assertEqual(parsed[0].exercises.length, 3, 'reorderCircuitItems - first circuit number of items unchanged after reordering');
            assertEqual(parsed[1].exercises.length, 3, 'reorderCircuitItems - second circuit number of items unchanged after reordering');
            assertEqual(parsed[2].exercises.length, 3, 'reorderCircuitItems - third circuit number of items unchanged after reordering');
        } catch (err) {
            console.error('[circuits.test] testCircuitReordering failure (we were suppsoed to move item 2 to item 3 in the second circuit', {
                workout: workout,
            });
            throw err;
        }

    }



    function testAppendSetToCircuit() {
        let workout = cycleThree.slice(); // copy cycle 3!
        workout = window.appendSetToCircuit(workout, 0);
        let parsed = window.workoutToCircuits(workout);
        assertEqual(parsed.length, 3, 'appendSetToCircuit - number of circuits unchanged');
        assertEqual(parsed[0].exercises.length, 3, 'appendSetToCircuit - circuit 1 cycle length unchanged');
        for (let i = 0; i < parsed[0].exercises.length; i++) {
            assertEqual(parsed[0].exercises[i].length, 4, `appendSetToCircuit - circuit 1 item ${i} has 4 rounds`);
        }
        assertEqual(parsed[1].exercises[0].length, 3, 'appendSetToCircuit - circuit 2 round count unchanged');
    }

    function testDeleteExerciseFromCircuit() {
        let workout = cycleThree.slice(); // copy cycle 3!
        workout = window.deleteExerciseFromCircuit(workout, 0, 1); // remove B from first circuit
        let parsed = window.workoutToCircuits(workout);
        assertEqual(parsed.length, 3, 'deleteExerciseFromCircuit - number of circuits unchanged');
        assertEqual(parsed[0].exercises.length, 2, 'deleteExerciseFromCircuit - circuit 1 cycle length reduced');
        assertEqual(parsed[0].exercises[0].length, 3, 'deleteExerciseFromCircuit - circuit 1 round count unchanged');
        assertEqual(parsed[0].exercises[0][0].groupId, 'A', 'deleteExerciseFromCircuit - first exercise is A');
        assertEqual(parsed[0].exercises[1][0].groupId, 'C', 'deleteExerciseFromCircuit - second exercise is C');
        assertEqual(parsed[1].exercises.length, 3, 'deleteExerciseFromCircuit - circuit 2 unchanged');
    }

    function runCircuitTests() {
        const results = [];
        const tests = [
            { name: 'testCircuitParsing', fn: testCircuitParsing },
            { name: 'testCircuitInsertion', fn: testCircuitInsertion },
            { name: 'testCircuitDeletion', fn: testCircuitDeletion },
            { name: 'testMoveCircuits', fn: testMoveCircuits },
            { name: 'testCircuitReordering', fn: testCircuitReordering },
            { name: 'testAppendSetToCircuit', fn: testAppendSetToCircuit },
            { name: 'testDeleteExerciseFromCircuit', fn: testDeleteExerciseFromCircuit },
        ];
        tests.forEach(test => {
            try {
                test.fn();
                results.push(`PASS ${test.name}`);
            } catch (err) {
                console.error(`[circuits.test] ${test.name} failed`, err);
                results.push(`FAIL ${test.name}: ${err.message}`);
            }
        });
        return results;
    }

    window.runCircuitTests = runCircuitTests;

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            const results = runCircuitTests();
            const list = document.getElementById('test-results');
            if (list) {
                results.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item;
                    list.appendChild(li);
                });
            } else {
                console.log('[circuits.test] results', results);
            }
        });
    }
})();
