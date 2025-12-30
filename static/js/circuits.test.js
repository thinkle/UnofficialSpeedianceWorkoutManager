
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

const cycleFour = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4,
    5, 6, 7, 8, 5, 6, 7, 8, 5, 6, 7, 8, 5, 6, 7, 8
].map(
    (num) => ({ groupId: String.fromCharCode(64 + num) })
);

const sandwichCycles = [
    1, 2, 3,
    1, 2, 3, // cycle 1
    1, 2, 4, // 2, 3, 4
    1, 2, 5, // 5, 6, 7
    1, 2, 6,  // 8, 9, 10
    1, // 11
    2, 7, 3, // cycle 2  - 12
    2, 7, 3
].map(
    (num) => ({ groupId: String.fromCharCode(64 + num) })
);

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

    function testCircuitParsing() {
        let parsed = window.workoutToCiruits(cycleTwoThreeFourFive);
        assertEqual(parsed.length, 4, 'cycleTwoThreeFourFive - number of circuits');
        assertEqual(parsed[0].exercises[0].length, 2, 'cycleTwoThreeFourFive - circuit 1 length');
        assertEqual(parsed[1].exercises[0].length, 3, 'cycleTwoThreeFourFive - circuit 2 length');
        assertEqual(parsed[2].exercises[0].length, 4, 'cycleTwoThreeFourFive - circuit 3 length');
        assertEqual(parsed[3].exercises[0].length, 5, 'cycleTwoThreeFourFive - circuit 4 length');
        for (let i = 0; i < parsed.length; i++) {
            // Each of these circuits contains only two exercises: A and the cycle exercise
            const circuit = parsed[i];
            assertEqual(parsed[i].exercises.length, 2, `cycleTwoThreeFourFive - circuit ${i + 1} number of exercise types`);
        }
        parsed = window.workoutToCiruits(cycleThree);
        assertEqual(parsed.length, 3, 'cycleThree - number of circuits');
        assertEqual(parsed[0].type, 'circuit', 'cycleThree - circuit 1 type');
        assertEqual(parsed[0].exercises[0].length, 3, 'cycleThree - circuit 1 length');
        assertEqual(parsed[1].type, 'circuit', 'cycleThree - circuit 2 type');
        assertEqual(parsed[1].exercises[0].length, 3, 'cycleThree - circuit 2 length');
        assertEqual(parsed[2].type, 'circuit', 'cycleThree - circuit 3 type');
        assertEqual(parsed[2].exercises[0].length, 3, 'cycleThree - circuit 3 length');
        parsed = window.workoutToCiruits(cycleFour);
        assertEqual(parsed.length, 4, 'cycleFour - number of circuits');
        assertEqual(parsed[0].exercises[0].length, 4, 'cycleFour - circuit 1 length');
        assertEqual(parsed[1].exercises[0].length, 4, 'cycleFour - circuit 2 length');
        assertEqual(parsed[2].exercises[0].length, 4, 'cycleFour - circuit 3 length');
        assertEqual(parsed[3].exercises[0].length, 4, 'cycleFour - circuit 4 length');
        parsed = window.workoutToCiruits(sandwichCycles);
        assertEqual(parsed.length, 12, 'sandwichCycles - number of circuits');
        assertEqual(parsed[0].exercises[0].length, 2, 'sandwichCycles - circuit 1 length');
        // We expect the second parsed item to be NOT a circuit in sandwich
        assertFalse(parsed[1].type === 'circuit', 'sandwichCycles - circuit 2 is not a circuit');
        assertEqual(parsed[1].groupId, 'A', 'sandwichCycles - circuit 2 groupId');
        assertEqual(parsed[2].groupId, 'B', 'sandwichCycles - circuit 2 groupId');
        assertEqual(parsed[1].groupId, 'A', 'sandwichCycles - circuit 2 groupId');
        assertEqual(parsed[11].exercises[0].length, 2, 'sandwichCycles - circuit 12 length');
    }

    function testCircuitDeletion() {
        let circuits = cycleThree.slice(); // copy cycle 3!
        let updatedCircuits = window.deleteSetFromCircuit(
            circuits,
            1, // circuit index
            1  // item index
        );
        // Now we expect the each set  circuit to have only two items
        let parsed = window.workoutToCiruits(updatedCircuits);
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
            let parsed = window.workoutToCiruits(circuits);
            assertEqual(parsed.length, 3, 'insertIntoCircuit - number of circuits after insertion should be unchanged');
            assertEqual(parsed[ci].exercises.length, 4, `insertIntoCircuit - circuit ${ci + 1} now has 4 items`);
            // Make sure each of the items has four exercises
            for (let i = 0; i < parsed[ci].exercises.length; i++) {
                assertEqual(parsed[ci].exercises[i].length, 4, `insertIntoCircuit - circuit ${ci + 1} item ${i} has 4 exercises`);
            }
        }
    }

    function testMoveCiruits() {
        let workout = cycleTwoThreeFourFive.slice(); // copy 2/3/4/5 length circuits...
        workout = window.moveCircuit(workout, 0, 2); // Move first circuit to the second index...
        // We expect now...
        // 1,3,1,3,1,3 (length 3)
        // 1,4,1,4,1,4,1,4 (length 4)
        // 1,2,1,2 (length 2)
        // 1,5,1,5,1,5,1,5,1,5 (length 5)
        assertEqual(workout[1].groupId, 'C', 'moveCircuit - first item in first circuit is now C');
        assertEqual(workout[15].groupId, 'B', 'moveCircuit - first item in second circuit is now B');
        let parsed = window.workoutToCiruits(workout); // parse our workout...        
        assertEqual(parsed.length, 4, 'moveCircuit - number of circuits after move should be unchanged');
        assertEqual(parsed[0].exercises[0].length, 3, 'moveCircuit - first circuit is now length 3');
        assertEqual(parsed[1].exercises[0].length, 4, 'moveCircuit - second circuit is now length 4');
        assertEqual(parsed[2].exercises[0].length, 2, 'moveCircuit - third circuit is now length 2');
        // Now test moving circuits in a "mixed" workout
        workout = sandwichCycles.slice(); // copy sandwich cycles...
        workout = window.moveCircuit(workout, 0, 5); // Move first circuit to the sixth index...
        parsed = window.workoutToCiruits(workout); // parse our workout...        
        assertEqual(parsed.length, 12, 'moveCircuit (mixed) - number of circuits after move should be unchanged');
        assertEqual(parsed[5].exercises[0].length, 2, 'moveCircuit (mixed) - sixth circuit is now length 2');
        // And our first item should now be a standalone exercise A
        assertEqual(parsed[0].groupId, 'A', 'moveCircuit (mixed) - first item is now standalone A');
        assertFalse(parsed[0].type === 'circuit', 'moveCircuit (mixed) - first item is not a circuit');
    }

    function testCircuitReordering() {
        let workout = cycleThree.slice(); // copy cycle 3!
        workout = reorderCircuitItems(workout, 0, 2, 0); // Swap first and last in first circuit
        for (let i of [0, 3, 6]) {
            assertEqual(workout[i].groupId, cycleThree[2], 'reorderCircuitItems - first item in first circuit is now C');
        }
        for (let i of [2, 5, 8]) {
            assertEqual(workout[i].groupId, cycleThree[0], 'reorderCircuitItems - last item in first circuit is now A');
        }
        for (let i of [1, 4, 7]) {
            assertEqual(workout[i].groupId, cycleThree[1], 'reorderCircuitItems - middle item in first circuit is still B');
        }
        assertEqual(workout[9].groupId, cycleThree[9], 'reorderCircuitItems - first item in second circuit is unchanged');
        let parsed = window.workoutToCiruits(workout);
        assertEqual(parsed.length, 3, 'reorderCircuitItems - number of circuits after reordering should be unchanged');
        assertEqual(parsed[0].exercises.length, 3, 'reorderCircuitItems - first circuit number of items unchanged after reordering');
        assertEqual(parsed[1].exercises.length, 3, 'reorderCircuitItems - second circuit number of items unchanged after reordering');
        assertEqual(parsed[2].exercises.length, 3, 'reorderCircuitItems - third circuit number of items unchanged after reordering');
    }


    function runCircuitTests() {
        testCircuitParsing();
        testCircuitInsertion();
        testCircuitDeletion();
        testMoveCiruits();
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
