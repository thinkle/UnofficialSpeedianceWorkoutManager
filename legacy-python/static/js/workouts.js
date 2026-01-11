const bootstrap = window.__WORKOUT_BOOTSTRAP__ || {};
const customInstruction = typeof bootstrap.customInstruction === 'string'
    ? bootstrap.customInstruction
    : '';

// --- KONFIGURATION DER PRESETS ---
// Definiert Ranges und Defaults basierend auf API Docs
const PRESET_RULES = {
    '-1': { // Custom
        label: "KG", step: 1,
        defW: 10, minW: 1, maxW: 100,
        defR: 10, minR: 1, maxR: 99,
        defRest: 60, minRest: 0, maxRest: 300
    },
    '1': { // Gain Muscle
        label: "RM", step: 1,
        defW: 13, minW: 9, maxW: 13,   // RM Scope
        defR: 12, minR: 8, maxR: 12,   // Reps Scope
        defRest: 60, minRest: 45, maxRest: 120
    },
    '3': { // Stamina
        label: "RM", step: 1,
        defW: 17, minW: 15, maxW: 20,
        defR: 15, minR: 13, maxR: 20,
        defRest: 45, minRest: 30, maxRest: 180
    },
    '5': { // Strength
        label: "RM", step: 1,
        defW: 7, minW: 4, maxW: 9,
        defR: 6, minR: 2, maxR: 8,
        defRest: 90, minRest: 60, maxRest: 180
    }
};

let workoutData = [];
let lastSelectedExerciseId = null;
let condensedView = false;
const selectedExerciseIds = new Set();
let pendingCircuitIndex = null;
const expandedCircuits = new Set();
let debugLogEnabled = true;
const existingData = bootstrap.existingWorkout || null;
const fullLibrary = Array.isArray(bootstrap.library) ? bootstrap.library : [];
const libraryById = new Map(fullLibrary.map(ex => [String(ex.id), ex]));
const userUnit = Number(bootstrap.unit || 0); // 0=Metric, 1=Imperial
let currentTemplateId = existingData ? existingData.id : null;

document.addEventListener('DOMContentLoaded', async () => {
    // Search & Filter Logic
    const searchInput = document.getElementById('search');
    const categoryFilter = document.getElementById('category-filter');
    const libraryList = document.getElementById('library-list');
    const condensedToggle = document.getElementById('condensed-toggle');
    const searchFulltext = document.getElementById('search-fulltext');
    const sameEquipment = document.getElementById('same-equipment');
    const enableDetailFilters = document.getElementById('enable-detail-filters');
    const fuzzyCable = document.getElementById('fuzzy-cable');
    const previousMissing = document.getElementById('previous-missing');
    const detailCable = document.getElementById('detail-cable');
    const detailBench = document.getElementById('detail-bench');
    const detailMissing = document.getElementById('detail-missing');
    const equipmentInclude = document.getElementById('equipment-include');
    const equipmentExclude = document.getElementById('equipment-exclude');
    const items = libraryList.querySelectorAll('.exercise-item');
    let currentDevice = 'all';
    const detailCache = new Map();
    const includeEquipment = new Set();
    const excludeEquipment = new Set();
    let previousHeight = null;
    let previousBench = null;
    const DETAIL_FETCH_LIMIT = 75;
    let detailFetchInFlight = false;
    const debugModal = document.getElementById('debug-workout-modal');
    const debugCloseButtons = document.querySelectorAll('[data-debug-close="true"]');

    function matchCategoryFilter(itemCat, catId) {
        if (catId === 'all') return true;
        const ids = catId.split(',');
        return ids.includes(itemCat);
    }

    function splitEquipment(text) {
        return text
            .split(',')
            .map(val => val.trim().toLowerCase())
            .filter(Boolean);
    }

    function buildEquipmentFilters() {
        const equipmentSet = new Set();
        items.forEach(item => {
            splitEquipment(item.getAttribute('data-equipment') || '').forEach(eq => equipmentSet.add(eq));
        });

        const sorted = Array.from(equipmentSet).sort();
        const renderOption = (name, container, setRef) => {
            const id = `${container.id}-${name.replace(/\\s+/g, '-')}`;
            const wrapper = document.createElement('label');
            wrapper.className = 'flex items-center gap-2 text-gray-300';
            wrapper.innerHTML = `<input type="checkbox" class="h-3.5 w-3.5" id="${id}"><span>${name}</span>`;
            const checkbox = wrapper.querySelector('input');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    setRef.add(name);
                } else {
                    setRef.delete(name);
                }
                filterLibrary();
            });
            container.appendChild(wrapper);
        };

        sorted.forEach(name => {
            renderOption(name, equipmentInclude, includeEquipment);
            renderOption(name, equipmentExclude, excludeEquipment);
        });
    }

    function createBadge(text, extraClass, dataKey) {
        const span = document.createElement('span');
        span.className = `px-1.5 py-0.5 rounded border ${extraClass}`;
        span.textContent = text;
        if (dataKey) {
            span.setAttribute(dataKey, 'true');
        }
        return span;
    }

    function renderEquipmentBadges() {
        items.forEach(item => {
            const container = item.querySelector('[data-badges]');
            if (!container) return;
            container.querySelectorAll('[data-equipment-badge]').forEach(el => el.remove());
            const eqList = splitEquipment(item.getAttribute('data-equipment') || '');
            eqList.forEach(eq => {
                const badge = createBadge(eq, 'bg-gray-800 border-gray-700 text-gray-400', 'data-equipment-badge');
                container.appendChild(badge);
            });
        });
    }

    function updateDetailBadges(ids) {
        ids.forEach(id => {
            const item = libraryList.querySelector(`[data-id="${id}"]`);
            if (!item) return;
            const container = item.querySelector('[data-badges]');
            if (!container) return;
            container.querySelectorAll('[data-detail-badge]').forEach(el => el.remove());
            const detail = detailCache.get(String(id));
            if (!detail) return;

            const cableVal = detail.outPosition === undefined || detail.outPosition === null ? "unknown" : String(detail.outPosition);
            const benchVal = detail.foldingStoolAngle === undefined || detail.foldingStoolAngle === null || detail.foldingStoolAngle === "" ? "unknown" : String(detail.foldingStoolAngle);

            const cableLabel = cableVal === "unknown" ? "Cable: Unknown" : `Cable: ${formatCablePosition(Number(cableVal))}`;
            const cableBadge = createBadge(cableLabel, 'bg-blue-900/30 border-blue-800 text-blue-300', 'data-detail-badge');
            container.appendChild(cableBadge);

            if (benchVal !== "unknown") {
                const benchBadge = createBadge(`Bench: ${benchVal}°`, 'bg-green-900/30 border-green-800 text-green-300', 'data-detail-badge');
                container.appendChild(benchBadge);
            }
        });
    }

    function matchEquipment(itemEquipment) {
        const eqList = splitEquipment(itemEquipment);
        if (includeEquipment.size > 0 && !eqList.some(eq => includeEquipment.has(eq))) {
            return false;
        }
        if (excludeEquipment.size > 0 && eqList.some(eq => excludeEquipment.has(eq))) {
            return false;
        }
        return true;
    }

    function normalizeEquipmentList(list) {
        return list.slice().sort();
    }

    function getPreviousEquipmentList() {
        if (!lastSelectedExerciseId) return null;
        const prevItem = libraryList.querySelector(`[data-id="${lastSelectedExerciseId}"]`);
        if (!prevItem) return null;
        return splitEquipment(prevItem.getAttribute('data-equipment') || '');
    }

    function matchSameEquipment(itemEquipment) {
        if (!sameEquipment || !sameEquipment.checked) return true;
        const prevList = getPreviousEquipmentList();
        if (!prevList) return true;
        const prevNormalized = normalizeEquipmentList(prevList);
        const itemNormalized = normalizeEquipmentList(splitEquipment(itemEquipment));
        if (prevNormalized.length !== itemNormalized.length) return false;
        return prevNormalized.every((val, idx) => val === itemNormalized[idx]);
    }

    async function ensurePreviousHeight() {
        if (!lastSelectedExerciseId) return null;
        if (!detailCache.has(lastSelectedExerciseId)) {
            await fetchDetailsForIds([lastSelectedExerciseId]);
        }
        const detail = detailCache.get(lastSelectedExerciseId);
        if (!detail) return null;
        if (detail.outPosition === undefined || detail.outPosition === null) {
            return "unknown";
        }
        return String(detail.outPosition);
    }

    async function ensurePreviousBench() {
        if (!lastSelectedExerciseId) return null;
        if (!detailCache.has(lastSelectedExerciseId)) {
            await fetchDetailsForIds([lastSelectedExerciseId]);
        }
        const detail = detailCache.get(lastSelectedExerciseId);
        if (!detail) return null;
        if (detail.foldingStoolAngle === undefined || detail.foldingStoolAngle === null || detail.foldingStoolAngle === "") {
            return "unknown";
        }
        return String(detail.foldingStoolAngle);
    }

    function setPreviousMessage(text) {
        if (!previousMissing) return;
        if (text) {
            previousMissing.textContent = text;
            previousMissing.classList.remove('hidden');
        } else {
            previousMissing.classList.add('hidden');
        }
    }

    function hasBaseFilters() {
        const term = searchInput.value.toLowerCase().trim();
        const hasTerm = term.length > 0;
        const hasCategory = categoryFilter.value !== 'all';
        const hasDevice = currentDevice !== 'all';
        const hasEquipment = includeEquipment.size > 0 || excludeEquipment.size > 0;
        const hasSameEquipment = sameEquipment && sameEquipment.checked;
        return hasTerm || hasCategory || hasDevice || hasEquipment || hasSameEquipment;
    }

    function detailFiltersActive() {
        if (!enableDetailFilters || !enableDetailFilters.checked) {
            return false;
        }
        return (detailCable.value !== 'all') || (detailBench.value !== 'all');
    }

    function setDetailMessage(text) {
        if (!detailMissing) return;
        if (text) {
            detailMissing.textContent = text;
            detailMissing.classList.remove('hidden');
        } else {
            detailMissing.classList.add('hidden');
        }
    }

    function getCandidateIds() {
        const term = searchInput.value.toLowerCase();
        const catId = categoryFilter.value;
        const terms = term.split(/\s+/).filter(Boolean);
        const useFulltext = searchFulltext && searchFulltext.checked;
        const sameEquipmentActive = sameEquipment && sameEquipment.checked;
        const prevEquipmentList = sameEquipmentActive ? getPreviousEquipmentList() : null;

        const ids = [];
        items.forEach(item => {
            const searchText = useFulltext
                ? item.getAttribute('data-search')
                : item.querySelector('[data-title]').getAttribute('data-title');
            const itemCat = item.getAttribute('data-category');
            const itemDevices = (item.getAttribute('data-device') || '').split(',');
            const itemId = item.getAttribute('data-id');
            const itemEquipment = item.getAttribute('data-equipment') || '';

            const matchesSearch = terms.length === 0 || terms.every(t => searchText.includes(t));
            const matchesCat = matchCategoryFilter(itemCat, catId);
            const matchesDevice = (currentDevice === 'all') || itemDevices.includes(currentDevice);
            const matchesEquipment = matchEquipment(itemEquipment);
            const matchesSameEquipment = !sameEquipmentActive || !prevEquipmentList || matchSameEquipment(itemEquipment);

            if (matchesSearch && matchesCat && matchesDevice && matchesEquipment && matchesSameEquipment) {
                ids.push(itemId);
            }
        });
        return ids;
    }

    function formatCablePosition(pos) {
        if (pos === 10) return "Platform End (Lowest/Floor)";
        if (pos === 0) return "Top (Highest)";
        return `Level ${pos}`;
    }

    async function fetchDetailsForIds(ids) {
        const chunkSize = 10;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (id) => {
                if (detailCache.has(id)) return;
                try {
                    const res = await fetch(`/api/exercise/${id}`);
                    const data = await res.json();
                    detailCache.set(id, {
                        outPosition: data.outPosition,
                        foldingStoolAngle: data.foldingStoolAngle,
                    });
                } catch (e) {
                    detailCache.set(id, { outPosition: null, foldingStoolAngle: null });
                }
            }));
            updateDetailBadges(chunk);
        }
    }

    function populateDetailFilters() {
        const cableValues = new Set();
        const benchValues = new Set();

        detailCache.forEach((detail) => {
            if (detail.outPosition !== undefined && detail.outPosition !== null) {
                cableValues.add(detail.outPosition);
            } else {
                cableValues.add("unknown");
            }
            if (detail.foldingStoolAngle !== undefined && detail.foldingStoolAngle !== null && detail.foldingStoolAngle !== "") {
                benchValues.add(String(detail.foldingStoolAngle));
            } else {
                benchValues.add("unknown");
            }
        });

        const sortedCable = Array.from(cableValues).sort((a, b) => {
            if (a === "unknown") return 1;
            if (b === "unknown") return -1;
            return Number(a) - Number(b);
        });
        const sortedBench = Array.from(benchValues).sort((a, b) => {
            if (a === "unknown") return 1;
            if (b === "unknown") return -1;
            return Number(a) - Number(b);
        });

        detailCable.innerHTML = '<option value="all">Cable height: Any</option>';
        sortedCable.forEach((val) => {
            const label = val === "unknown" ? "Unknown" : formatCablePosition(Number(val));
            detailCable.innerHTML += `<option value="${val}">${label}</option>`;
        });

        detailBench.innerHTML = '<option value="all">Bench angle: Any</option>';
        sortedBench.forEach((val) => {
            const label = val === "unknown" ? "Unknown" : `${val}°`;
            detailBench.innerHTML += `<option value="${val}">${label}</option>`;
        });
    }

    async function filterLibrary() {
        const term = searchInput.value.toLowerCase();
        const catId = categoryFilter.value;
        const terms = term.split(/\s+/).filter(Boolean);
        const useFulltext = searchFulltext && searchFulltext.checked;
        let missingCount = 0;
        let missingPrevious = false;
        const sameEquipmentActive = sameEquipment && sameEquipment.checked;
        const prevEquipmentList = sameEquipmentActive ? getPreviousEquipmentList() : null;
        const heightFilterActive = previousHeight !== null && detailCable.value !== 'all';
        const benchFilterActive = previousBench !== null && detailBench.value !== 'all';
        const fuzzyActive = fuzzyCable && fuzzyCable.checked;

        const baseFiltersActive = hasBaseFilters();
        const detailActive = detailFiltersActive();
        let applyDetailFilters = false;
        let candidateIds = [];
        let missingIds = [];

        if (detailActive) {
            if (!baseFiltersActive) {
                setDetailMessage(`Detail filters auto-load when base filters are active (up to ${DETAIL_FETCH_LIMIT} results).`);
            } else {
                candidateIds = getCandidateIds();
                if (candidateIds.length > DETAIL_FETCH_LIMIT) {
                    setDetailMessage(`Detail filters paused at ${candidateIds.length} results. Narrow your filters below ${DETAIL_FETCH_LIMIT}.`);
                } else {
                    missingIds = candidateIds.filter(id => !detailCache.has(id));
                    if (missingIds.length > 0) {
                        setDetailMessage(`Loading details for ${missingIds.length} exercises...`);
                        if (!detailFetchInFlight) {
                            detailFetchInFlight = true;
                            await fetchDetailsForIds(missingIds);
                            detailFetchInFlight = false;
                            populateDetailFilters();
                            detailCable.disabled = false;
                            detailBench.disabled = false;
                            if (previousHeight !== null) {
                                detailCable.value = String(previousHeight);
                            }
                            if (previousBench !== null && previousBench !== "unknown") {
                                detailBench.value = String(previousBench);
                            }
                            return filterLibrary();
                        }
                    } else if (detailCable.disabled || detailBench.disabled) {
                        populateDetailFilters();
                        detailCable.disabled = false;
                        detailBench.disabled = false;
                    } else {
                        setDetailMessage('');
                    }
                    applyDetailFilters = missingIds.length === 0;
                }
            }
        } else {
            setDetailMessage('');
        }

        items.forEach(item => {
            const searchText = useFulltext
                ? item.getAttribute('data-search')
                : item.querySelector('[data-title]').getAttribute('data-title');
            const itemCat = item.getAttribute('data-category');
            const itemDevices = (item.getAttribute('data-device') || '').split(',');
            const itemId = item.getAttribute('data-id');
            const itemEquipment = item.getAttribute('data-equipment') || '';

            const matchesSearch = terms.length === 0 || terms.every(t => searchText.includes(t));
            const matchesCat = matchCategoryFilter(itemCat, catId);
            const matchesDevice = (currentDevice === 'all') || itemDevices.includes(currentDevice);
            const matchesEquipment = matchEquipment(itemEquipment);
            const matchesSameEquipment = !sameEquipmentActive || !prevEquipmentList || matchSameEquipment(itemEquipment);
            const baseMatch = matchesSearch && matchesCat && matchesDevice && matchesEquipment && matchesSameEquipment;
            let matchesDetail = true;
            if (detailActive && applyDetailFilters) {
                const detail = detailCache.get(itemId);
                if (!detail) {
                    matchesDetail = false;
                } else {
                    const cableVal = detail.outPosition === undefined || detail.outPosition === null ? "unknown" : String(detail.outPosition);
                    const benchVal = detail.foldingStoolAngle === undefined || detail.foldingStoolAngle === null || detail.foldingStoolAngle === "" ? "unknown" : String(detail.foldingStoolAngle);
                    const selectedCable = detailCable.value;
                    const selectedBench = detailBench.value;
                    if (heightFilterActive && selectedCable !== 'all') {
                        if (cableVal === 'unknown') {
                            matchesDetail = false;
                        } else if (fuzzyActive) {
                            const delta = Math.abs(Number(cableVal) - Number(selectedCable));
                            if (Number.isNaN(delta) || delta > 1) matchesDetail = false;
                        } else if (cableVal !== selectedCable) {
                            matchesDetail = false;
                        }
                    }
                    if (selectedBench !== 'all' && benchVal !== selectedBench) matchesDetail = false;
                }
            }

            if (baseMatch && matchesDetail) {
                item.classList.remove('hidden');
                item.classList.add('flex');
            } else {
                item.classList.add('hidden');
                item.classList.remove('flex');
            }
        });

        if (sameEquipmentActive && !prevEquipmentList) {
            missingPrevious = true;
        }
        if (detailActive && (previousHeight === null || previousBench === null)) {
            missingPrevious = true;
        }
        setPreviousMessage(missingPrevious ? 'Add an exercise to use previous-based filters.' : '');
    }

    window.filterByDevice = (deviceType, btnElement) => {
        currentDevice = deviceType;
        document.querySelectorAll('.device-btn').forEach(btn => {
            btn.classList.remove('bg-yellow-600', 'text-white');
            btn.classList.add('bg-gray-800', 'text-gray-300', 'border-gray-700');
        });
        btnElement.classList.remove('bg-gray-800', 'text-gray-300', 'border-gray-700');
        btnElement.classList.add('bg-yellow-600', 'text-white');
        filterLibrary();
    };

    sameEquipment.addEventListener('change', filterLibrary);
    enableDetailFilters.addEventListener('change', async () => {
        if (enableDetailFilters.checked) {
            previousHeight = await ensurePreviousHeight();
            previousBench = await ensurePreviousBench();
            if (previousHeight !== null) {
                detailCable.value = String(previousHeight);
            }
            if (previousBench !== null && previousBench !== "unknown") {
                detailBench.value = String(previousBench);
            }
        }
        filterLibrary();
    });
    fuzzyCable.addEventListener('change', filterLibrary);

    detailCable.addEventListener('change', filterLibrary);
    detailBench.addEventListener('change', filterLibrary);
    searchInput.addEventListener('input', filterLibrary);
    categoryFilter.addEventListener('change', filterLibrary);
    searchFulltext.addEventListener('change', filterLibrary);

    condensedToggle.checked = condensedView;
    condensedToggle.addEventListener('change', () => {
        condensedView = condensedToggle.checked;
        renderBuilder();
    });

    window.onPreviousExerciseChanged = async () => {
        if (enableDetailFilters.checked) {
            previousHeight = await ensurePreviousHeight();
            previousBench = await ensurePreviousBench();
            if (previousHeight !== null) {
                detailCable.value = String(previousHeight);
            }
            if (previousBench !== null && previousBench !== "unknown") {
                detailBench.value = String(previousBench);
            }
        }
        filterLibrary();
    };

    buildEquipmentFilters();
    renderEquipmentBadges();
    if (debugModal) {
        debugModal.addEventListener('click', (event) => {
            if (event.target === debugModal) {
                closeDebugModal();
            }
        });
    }
    debugCloseButtons.forEach(btn => {
        console.log('Wiring up debug close button', btn);
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            console.log('Debug close button clicked');
            debugger;
            closeDebugModal();
        });
    });
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeDebugModal();
        }
    });

    if (existingData) {
        await loadExistingWorkout(existingData);
    } else {
        renderBuilder();
    }
});

function summarizeWorkout(data) {
    return data.map((ex, idx) => ({
        index: idx,
        title: ex.title,
        groupId: ex.groupId,
        sets: (ex.sets || []).map(set => ({
            reps: set.reps,
            weight: set.weight,
            mode: set.mode,
            rest: set.rest,
            unit: set.unit,
        })),
    }));
}

function logWorkoutChange(action, beforeState) {
    if (!debugLogEnabled) return;
    console.log(`[WORKOUT] ${action} before`, beforeState);
    console.log(`[WORKOUT] ${action} after`, summarizeWorkout(workoutData));
}

function logDebugModalState(action, modal) {
    const nodes = Array.from(document.querySelectorAll('#debug-workout-modal'));
    const snapshots = nodes.map((el, index) => ({
        index,
        isTarget: el === modal,
        className: el.className,
        rect: el.getBoundingClientRect(),
    }));
    console.log(`[DEBUG MODAL] ${action}`, { count: nodes.length, snapshots });
}

function withWorkoutLog(action, fn) {
    const before = debugLogEnabled ? summarizeWorkout(workoutData) : null;
    const result = fn();
    if (debugLogEnabled) {
        logWorkoutChange(action, before);
    }
    return result;
}

window.openDebugModal = () => {
    const modal = document.getElementById('debug-workout-modal');
    const textarea = document.getElementById('debug-workout-json');
    if (textarea) {
        textarea.value = JSON.stringify(summarizeWorkout(workoutData), null, 2);
    }
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        logDebugModalState('open', modal);
    }
};

window.closeDebugModal = () => {
    const modal = document.getElementById('debug-workout-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        logDebugModalState('close', modal);
    }
};

window.copyDebugJSON = () => {
    const textarea = document.getElementById('debug-workout-json');
    if (!textarea) return;
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(textarea.value);
    alert("Workout JSON copied to clipboard.");
};

// --- LADE LOGIK ---
async function fetchExerciseMetadata(groupId) {
    try {
        const res = await fetch(`/api/exercise/${groupId}`);
        const details = await res.json();
        return {
            variants: details.actionLibraryList || [],
            presets: details.templatePresetList || [],
            isUnilateral: details.isLeftRight === 1,
            outPosition: details.outPosition,
            foldingStoolAngle: details.foldingStoolAngle,
        };
    } catch (e) {
        return { variants: [], presets: [], isUnilateral: false, outPosition: null, foldingStoolAngle: null };
    }
}

async function loadExistingWorkout(data) {
    document.getElementById('plan-name').value = data.name;

    const groupIds = Array.from(new Set(data.actionLibraryList.map(apiEx => apiEx.groupId || apiEx.actionLibraryId)));
    const metadataPromises = groupIds.map(id => fetchExerciseMetadata(id));
    const allMetadata = await Promise.all(metadataPromises);
    const metadataMap = allMetadata.reduce((acc, meta, index) => {
        acc[groupIds[index]] = meta;
        return acc;
    }, {});

    for (const apiEx of data.actionLibraryList) {
        const groupId = apiEx.groupId || apiEx.actionLibraryId;
        const meta = metadataMap[groupId] || { isUnilateral: false, variants: [], presets: [] };

        const reps = (apiEx.setsAndReps || "").toString().split(',');
        const weights = (apiEx.weights || "").toString().split(',');
        const counters = (apiEx.counterweight2 || "").toString().split(',');
        const modes = (apiEx.sportMode || "").toString().split(',');
        const breaks = (apiEx.breakTime2 || "").toString().split(',');
        const leftRights = (apiEx.leftRight || "").toString().split(',');

        // For unilateral exercises, the API returns L and R sets separately (e.g. L1, R1, L2, R2).
        // Our UI model (workoutData) stores ALL sets (L and R) as individual objects in the `sets` array.
        // The UI rendering loop then iterates over this array and displays them.
        // So we should NOT filter by "Left" only. We should parse ALL sets.

        const setsParsed = reps.map((rep, i) => {
            let w = 0;
            const presetId = parseInt(apiEx.templatePresetId);
            const isRM = presetId !== -1;

            if (isRM) {
                // Preset workouts: use counterweight2 (RM).
                w = parseInt(counters[i] || 0);
            } else {
                // Custom workouts: API `weights` are stored as KG.
                const val = parseFloat(weights[i] || 0);
                if (!isNaN(val) && val > 0) {
                    w = Math.round(val);
                }
            }

            return {
                reps: parseInt(rep),
                weight: w,
                mode: parseInt(modes[i] || 1),
                rest: parseInt(breaks[i] || 60),
                unit: 'reps'
            };
        });

        const lib = libraryById.get(String(groupId));
        workoutData.push({
            internalId: Date.now() + Math.random(),
            groupId: parseInt(groupId),
            title: apiEx.title,
            img: apiEx.img,
            isUnilateral: meta.isUnilateral,
            variants: meta.variants,
            presets: meta.presets,
            selectedVariantId: parseInt(apiEx.actionLibraryId),
            selectedPresetId: parseInt(apiEx.templatePresetId),
            sets: setsParsed,
            outPosition: meta.outPosition,
            foldingStoolAngle: meta.foldingStoolAngle,
            equipmentName: lib ? lib.equipment_name : ''
        });
        lastSelectedExerciseId = String(groupId);
    }
    if (window.onPreviousExerciseChanged) {
        window.onPreviousExerciseChanged();
    }
    renderBuilder();
}

// --- ADD EXERCISE ---
function buildDefaultSets(meta, setCount) {
    const rules = PRESET_RULES['-1'];
    const newSetTemplate = {
        reps: rules.defR,
        weight: rules.defW,
        mode: 1,
        rest: rules.defRest,
        unit: 'reps'
    };

    const startSets = [];
    for (let i = 0; i < setCount; i++) {
        startSets.push({ ...newSetTemplate });
        if (meta.isUnilateral) startSets.push({ ...newSetTemplate });
    }
    return startSets;
}

function getWorkoutBlocks(data = workoutData) {
    const parsed = Circuits.workoutToCircuits(data);
    const blocks = [];
    let cursor = 0;
    let circuitCount = 0;
    parsed.forEach((item, blockIndex) => {
        if (item && item.type === 'circuit') {
            const cycleLen = item.exercises.length;
            const rounds = item.exercises[0] ? item.exercises[0].length : 0;
            const length = cycleLen * rounds;
            circuitCount += 1;
            blocks.push({
                type: 'circuit',
                blockIndex,
                displayIndex: circuitCount,
                start: cursor,
                length,
                cycleLen,
                rounds,
                exercises: item.exercises,
            });
            cursor += length;
            return;
        }
        blocks.push({
            type: 'single',
            blockIndex,
            index: cursor,
            exercise: item,
        });
        cursor += 1;
    });
    return blocks;
}

function getCircuitBlockByIndex(blockIndex, blocks = null) {
    const parsed = blocks || getWorkoutBlocks();
    const block = parsed.find(item => item.blockIndex === blockIndex);
    if (!block || block.type !== 'circuit') return null;
    return block;
}

function buildCircuitRoundEntries(exercise, rounds) {
    const groups = getSetGroups(exercise);
    const paddedGroups = [];
    for (let i = 0; i < rounds; i += 1) {
        paddedGroups.push(groups[i] || groups[groups.length - 1] || []);
    }
    return paddedGroups.map(group => cloneExerciseForCircuit(exercise, group));
}

function insertExerciseIntoCircuit(blockIndex, newEx) {
    const blocks = getWorkoutBlocks();
    const block = getCircuitBlockByIndex(blockIndex, blocks);
    if (!block) return null;
    const start = block.start;
    const end = block.start + block.length;
    const segment = workoutData.slice(start, end);
    const existingIds = new Set(segment.map(ex => String(ex.groupId)));
    if (existingIds.has(String(newEx.groupId))) return null;

    let updated = Circuits.appendOntoCircuit(workoutData, blockIndex, newEx);
    const nextBlocks = getWorkoutBlocks(updated);
    const nextBlock = getCircuitBlockByIndex(blockIndex, nextBlocks);
    if (!nextBlock) return updated;

    const rounds = nextBlock.rounds;
    const entries = buildCircuitRoundEntries(newEx, rounds);
    const nextStart = nextBlock.start;
    const cycleLen = nextBlock.cycleLen;
    const patched = updated.slice();
    for (let round = 0; round < rounds; round += 1) {
        const insertIndex = nextStart + round * cycleLen + (cycleLen - 1);
        if (entries[round]) {
            patched[insertIndex] = entries[round];
        }
    }
    return patched;
}

function addExerciseToCircuit(blockIndex, newEx) {
    withWorkoutLog('addExerciseToCircuit', () => {
        const updated = insertExerciseIntoCircuit(blockIndex, newEx);
        if (!updated) return;
        workoutData = updated;
    });
}

async function addExerciseToPlan(groupId, title, img) {
    const tempId = Date.now();
    try {
        const meta = await fetchExerciseMetadata(groupId);
        const targetCircuit = pendingCircuitIndex !== null ? getCircuitBlockByIndex(pendingCircuitIndex) : null;
        if (pendingCircuitIndex !== null && !targetCircuit) {
            pendingCircuitIndex = null;
            updatePendingCircuitUI();
        }
        let setCount = 3;
        if (targetCircuit) {
            setCount = targetCircuit.rounds || 1;
        }
        const startSets = buildDefaultSets(meta, setCount);

        const lib = libraryById.get(String(groupId));
        const newEx = {
            internalId: tempId,
            groupId: groupId,
            title: title,
            img: img,
            isUnilateral: meta.isUnilateral,
            variants: meta.variants,
            presets: meta.presets,
            selectedVariantId: meta.variants?.[0]?.id || groupId,
            selectedPresetId: -1, // Custom Default
            sets: startSets,
            outPosition: meta.outPosition,
            foldingStoolAngle: meta.foldingStoolAngle,
            equipmentName: lib ? lib.equipment_name : ''
        };

        if (pendingCircuitIndex !== null) {
            addExerciseToCircuit(pendingCircuitIndex, newEx);
        } else {
            withWorkoutLog('addExerciseToPlan', () => {
                workoutData.push(newEx);
            });
        }
        lastSelectedExerciseId = String(groupId);
        if (window.onPreviousExerciseChanged) {
            window.onPreviousExerciseChanged();
        }
        renderBuilder();

    } catch (e) {
        alert("Error loading exercise details.");
    }
}

// --- HELPER ---
function getRules(ex) {
    let rules = PRESET_RULES[ex.selectedPresetId] || PRESET_RULES['-1'];
    // Adjust limits for Custom (KG) based on Unilateral/Bilateral
    if (ex.selectedPresetId == -1) {
        rules = { ...rules }; // Clone

        // Handle Imperial
        if (userUnit === 1) {
            rules.label = "LBS";
            // Convert limits to LBS roughly for UI limits
            if (ex.isUnilateral) {
                rules.maxW = 110;
                rules.minW = 9;
            } else {
                rules.maxW = 220;
                rules.minW = 15;
            }
        } else {
            // Metric
            if (ex.isUnilateral) {
                rules.maxW = 50;
                rules.minW = 4;
            } else {
                rules.maxW = 100;
                rules.minW = 7;
            }
        }
    }
    return rules;
}

// --- RENDER UI ---
function splitEquipmentText(text) {
    return (text || '')
        .split(',')
        .map(val => val.trim())
        .filter(Boolean);
}

function formatCablePositionLabel(pos) {
    if (pos === 10) return "Platform End (Lowest/Floor)";
    if (pos === 0) return "Top (Highest)";
    return `Level ${pos}`;
}

function renderWorkoutBadges(ex) {
    const badges = [];
    splitEquipmentText(ex.equipmentName).forEach(eq => {
        badges.push(`<span class="px-1.5 py-0.5 rounded border bg-gray-800 border-gray-700 text-gray-400">${eq}</span>`);
    });
    if (ex.outPosition !== undefined && ex.outPosition !== null) {
        const label = formatCablePositionLabel(Number(ex.outPosition));
        badges.push(`<span class="px-1.5 py-0.5 rounded border bg-blue-900/30 border-blue-800 text-blue-300">Cable: ${label}</span>`);
    }
    if (ex.foldingStoolAngle !== undefined && ex.foldingStoolAngle !== null && ex.foldingStoolAngle !== "") {
        badges.push(`<span class="px-1.5 py-0.5 rounded border bg-green-900/30 border-green-800 text-green-300">Bench: ${ex.foldingStoolAngle}°</span>`);
    }
    return badges.length ? `<div class="mt-2 flex flex-wrap gap-1 text-[10px] text-gray-400">${badges.join('')}</div>` : '';
}

function formatSetEntry(set) {
    return set.unit === 'sec' ? `${set.reps}s` : `${set.reps}x`;
}

function summarizeEntrySets(ex) {
    const groups = getSetGroups(ex);
    return groups.map(group => formatSetEntry(group[0])).join(', ');
}

function renderWorkoutBadgesCompact(ex) {
    const badges = [];
    splitEquipmentText(ex.equipmentName).forEach(eq => {
        badges.push(`<span class="px-1.5 py-0.5 rounded border bg-gray-800 border-gray-700 text-gray-400">${eq}</span>`);
    });
    if (ex.outPosition !== undefined && ex.outPosition !== null) {
        const label = formatCablePositionLabel(Number(ex.outPosition));
        badges.push(`<span class="px-1.5 py-0.5 rounded border bg-blue-900/30 border-blue-800 text-blue-300">Cable: ${label}</span>`);
    }
    if (ex.foldingStoolAngle !== undefined && ex.foldingStoolAngle !== null && ex.foldingStoolAngle !== "") {
        badges.push(`<span class="px-1.5 py-0.5 rounded border bg-green-900/30 border-green-800 text-green-300">Bench: ${ex.foldingStoolAngle}°</span>`);
    }
    return badges.length ? `<span class="flex flex-wrap gap-1">${badges.join('')}</span>` : '';
}

function renderCondensedRow(ex, exIndex) {
    const summary = summarizeEntrySets(ex);
    const badges = renderWorkoutBadgesCompact(ex);
    const canMoveUp = exIndex > 0;
    const canMoveDown = exIndex < workoutData.length - 1;
    const isSelected = selectedExerciseIds.has(ex.internalId);
    return `
            <div class="bg-gray-900 rounded-lg border border-gray-700 p-3 flex flex-col gap-1" ondblclick="editExerciseByIndex(${exIndex})">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" class="h-4 w-4" ${isSelected ? 'checked' : ''} onchange="toggleExerciseSelection('${ex.internalId}', this.checked)">
                        <div class="text-sm font-bold text-white">${ex.title}</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="moveEx(${exIndex}, -1)" class="text-gray-400 hover:text-white disabled:opacity-30" ${canMoveUp ? '' : 'disabled'} title="Move Up">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                        </button>
                        <button onclick="moveEx(${exIndex}, 1)" class="text-gray-400 hover:text-white disabled:opacity-30" ${canMoveDown ? '' : 'disabled'} title="Move Down">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <button onclick="removeEx(${exIndex})" class="text-red-500 hover:text-red-400 text-xs">✖ Remove</button>
                    </div>
                </div>
                <div class="text-xs text-gray-400 flex flex-wrap items-center gap-2">
                    <span>${summary}</span>
                    ${badges}
                </div>
            </div>
        `;
}

function buildCircuitRowsFromDetected(data, start, cycleLen, rounds) {
    const rows = [];
    for (let pos = 0; pos < cycleLen; pos += 1) {
        const entries = [];
        for (let round = 0; round < rounds; round += 1) {
            const idx = start + pos + (round * cycleLen);
            const entry = data[idx];
            if (entry) entries.push(entry);
        }
        const first = entries[0];
        if (!first) continue;
        rows.push({
            title: first.title,
            groupId: first.groupId,
            img: first.img,
            summaries: entries.map(summarizeEntrySets),
            orderKey: pos,
        });
    }
    return rows;
}

function renderCircuitTable(label, rounds, rows, actionsHtml, options = {}) {
    const showImages = options.showImages === true;
    const allowRowReorder = options.allowRowReorder === true;
    const circuitKey = options.circuitKey || '';
    const headers = Array.from({ length: rounds }, (_, idx) => `R${idx + 1}`);
    const headerCells = headers.map(h => `<th class="px-2 py-1 text-[10px] text-gray-500 uppercase">${h}</th>`).join('');
    const bodyRows = rows.map((row, rowIndex) => {
        const cells = [];
        for (let i = 0; i < rounds; i += 1) {
            cells.push(`<td class="px-2 py-1 text-xs text-gray-300">${row.summaries[i] || '-'}</td>`);
        }
        const imageHtml = showImages && row.img
            ? `<img src="${row.img}" class="w-8 h-8 rounded object-cover bg-black" alt="${row.title}">`
            : '';
        const rowControls = allowRowReorder ? `
                <button class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 border border-gray-600 mr-1" title="Move Up" onclick="moveCircuitExercise('${circuitKey}', ${row.orderKey}, -1)" ${rowIndex === 0 ? 'disabled' : ''}>
                    <svg class="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                </button>
                <button class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 border border-gray-600 mr-2" title="Move Down" onclick="moveCircuitExercise('${circuitKey}', ${row.orderKey}, 1)" ${rowIndex === rows.length - 1 ? 'disabled' : ''}>
                    <svg class="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <button class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-red-300 border border-red-700/60 mr-2" title="Remove" onclick="removeCircuitExercise('${circuitKey}', ${row.orderKey})">
                    <svg class="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            ` : '';
        return `
                <tr class="border-t border-gray-800">
                    <td class="px-2 py-1 text-xs text-gray-200 font-medium">
                        <button class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 border border-gray-600 mr-2" title="Edit" onclick="editExerciseFromCircuit('${row.groupId}')">
                            <svg class="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L7 21H3v-4L16.732 4.732z"></path>
                            </svg>
                        </button>
                        ${rowControls}
                        ${imageHtml ? `<span class=\"inline-flex items-center mr-2\">${imageHtml}</span>` : ''}
                        ${row.title}
                    </td>
                    ${cells.join('')}
                </tr>
            `;
    }).join('');
    return `
            <div class="bg-gray-900 rounded-lg border border-blue-900/50 p-3 space-y-2">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="text-sm font-bold text-blue-300">${label} (x${rounds})</div>
                    </div>
                    <div class="flex gap-2">${actionsHtml || ''}</div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-[10px] text-gray-500 uppercase">
                                <th class="px-2 py-1">Exercise</th>
                                ${headerCells}
                            </tr>
                        </thead>
                        <tbody>
                            ${bodyRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
}

function buildCircuitExerciseView(orderKey, entries) {
    const ordered = entries.slice().sort((a, b) => {
        const roundA = a.round ?? 1;
        const roundB = b.round ?? 1;
        return roundA - roundB;
    });
    const base = ordered[0].entry;
    const setMap = [];
    const sets = [];
    const entryIndexes = [];
    ordered.forEach(item => {
        entryIndexes.push(item.index);
        item.entry.sets.forEach((set, setIndex) => {
            setMap.push({ entryIndex: item.index, setIndex });
            sets.push(set);
        });
    });
    return {
        orderKey,
        entryIndexes,
        setMap,
        sets,
        groupId: base.groupId,
        title: base.title,
        img: base.img,
        isUnilateral: base.isUnilateral,
        variants: base.variants,
        presets: base.presets,
        selectedVariantId: base.selectedVariantId,
        selectedPresetId: base.selectedPresetId,
        equipmentName: base.equipmentName,
        outPosition: base.outPosition,
        foldingStoolAngle: base.foldingStoolAngle,
    };
}

function buildCircuitExerciseViewFromBlock(block, orderKey) {
    const entries = [];
    for (let round = 0; round < block.rounds; round += 1) {
        const idx = block.start + orderKey + (round * block.cycleLen);
        const entry = workoutData[idx];
        if (entry) {
            entries.push({ entry, index: idx, round: round + 1 });
        }
    }
    if (!entries.length) return null;
    return buildCircuitExerciseView(orderKey, entries);
}

function buildCircuitExerciseViews(block) {
    const exercises = [];
    for (let pos = 0; pos < block.cycleLen; pos += 1) {
        const view = buildCircuitExerciseViewFromBlock(block, pos);
        if (view) exercises.push(view);
    }
    return exercises;
}

function isCircuitExerciseSelected(exercise) {
    if (!exercise.entryIndexes.length) return false;
    return exercise.entryIndexes.every(idx => {
        const entry = workoutData[idx];
        return entry && selectedExerciseIds.has(entry.internalId);
    });
}

function renderCircuitExerciseCard(circuitKey, ex, options = {}) {
    const rules = getRules(ex);
    const allowSelection = options.allowSelection !== false;
    const allowReorder = options.allowReorder !== false;
    const allowRemove = options.allowRemove !== false;
    const allowSetEditing = options.allowSetEditing !== false;
    const orderIndex = options.orderIndex ?? 0;
    const total = options.total ?? 1;
    const isSelected = allowSelection ? isCircuitExerciseSelected(ex) : false;

    let variantsHtml = ex.variants.map(v =>
        `<option value="${v.id}" ${v.id == ex.selectedVariantId ? 'selected' : ''}>Coach ${v.coach ? v.coach.name : 'Standard'}</option>`
    ).join('');

    let presetsHtml = `
            <option value="-1" ${ex.selectedPresetId == -1 ? 'selected' : ''}>Customize (KG)</option>
            <option value="1" ${ex.selectedPresetId == 1 ? 'selected' : ''}>Gain Muscle (RM)</option>
            <option value="3" ${ex.selectedPresetId == 3 ? 'selected' : ''}>Stamina (RM)</option>
            <option value="5" ${ex.selectedPresetId == 5 ? 'selected' : ''}>Strength (RM)</option>
        `;

    const unilateralWarning = ex.isUnilateral ? `<p class="text-xs text-yellow-400 mt-1">Unilateral: L/R Sets</p>` : '';

    const moveUpDisabled = !allowReorder || orderIndex === 0;
    const moveDownDisabled = !allowReorder || orderIndex === total - 1;

    const moveButtons = allowReorder ? `
            <button onclick="moveCircuitExercise('${circuitKey}', ${ex.orderKey}, -1)" class="text-gray-400 hover:text-white disabled:opacity-30" ${moveUpDisabled ? 'disabled' : ''} title="Move Up">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
            </button>
            <button onclick="moveCircuitExercise('${circuitKey}', ${ex.orderKey}, 1)" class="text-gray-400 hover:text-white disabled:opacity-30" ${moveDownDisabled ? 'disabled' : ''} title="Move Down">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
        ` : '';

    const removeButton = allowRemove
        ? `<button onclick="removeCircuitExercise('${circuitKey}', ${ex.orderKey})" class="text-red-500 hover:text-red-400 text-sm ml-2">✖ Remove</button>`
        : '';

    const selectionHtml = allowSelection
        ? `<input type="checkbox" class="h-4 w-4" ${isSelected ? 'checked' : ''} onchange="toggleCircuitExerciseSelection('${circuitKey}', ${ex.orderKey}, this.checked)">`
        : '';

    const setRows = ex.sets.map((set, sIdx) => {
        let setDisplay = "";
        let sideLabel = "";

        if (ex.isUnilateral) {
            const realSetNum = Math.floor(sIdx / 2) + 1;
            const isLeft = sIdx % 2 === 0;
            setDisplay = `${realSetNum}`;
            sideLabel = isLeft ? `<span class="text-green-400 font-bold mr-1">L</span>` : `<span class="text-blue-400 font-bold mr-1">R</span>`;
        } else {
            setDisplay = sIdx + 1;
        }

        const inputAttrs = allowSetEditing ? '' : 'disabled';
        const buttonAttrs = allowSetEditing ? '' : 'disabled';
        return `
            <div class="grid grid-cols-12 gap-2 items-center bg-gray-800/50 rounded p-1">
                <div class="col-span-1 text-center text-gray-400 font-mono flex justify-center items-center">${sideLabel}${setDisplay}</div>
                
                <div class="col-span-3 flex gap-1">
                    <input type="number" 
                           min="${rules.minR}" max="${rules.maxR}" step="1"
                           value="${set.reps}" 
                           onchange="validateAndSetCircuit('${circuitKey}', ${ex.orderKey}, ${sIdx}, 'reps', this)" 
                           class="w-full bg-gray-700 text-white text-center rounded border border-gray-600 p-1" ${inputAttrs}>
                    <button onclick="toggleCircuitUnit('${circuitKey}', ${ex.orderKey}, ${sIdx})" class="px-1 text-[10px] bg-gray-700 text-gray-400 rounded w-8 border border-gray-600" ${buttonAttrs}>${set.unit === 'reps' ? 'Rep' : 'Sec'}</button>
                </div>
                <div class="col-span-2">
                    <input type="number" 
                           min="${rules.minW}" max="${rules.maxW}" step="${rules.step}"
                           value="${set.weight}" 
                           onchange="validateAndSetCircuit('${circuitKey}', ${ex.orderKey}, ${sIdx}, 'weight', this)" 
                           class="w-full bg-gray-700 ${ex.selectedPresetId != -1 ? 'text-yellow-400 font-bold' : 'text-white'} text-center rounded border border-gray-600 p-1" ${inputAttrs}>
                </div>
                <div class="col-span-3">
                    <select onchange="updateCircuitSet('${circuitKey}', ${ex.orderKey}, ${sIdx}, 'mode', this.value)" class="w-full bg-gray-700 text-white text-[10px] rounded border border-gray-600 p-1" ${inputAttrs}>
                        <option value="1" ${set.mode == 1 ? 'selected' : ''}>Standard</option>
                        <option value="2" ${set.mode == 2 ? 'selected' : ''}>Chains</option>
                        <option value="3" ${set.mode == 3 ? 'selected' : ''}>Eccentric</option>
                    </select>
                </div>
                <div class="col-span-2">
                    <input type="number" 
                           min="${rules.minRest}" max="${rules.maxRest}" step="5"
                           value="${set.rest}" 
                           onchange="validateAndSetCircuit('${circuitKey}', ${ex.orderKey}, ${sIdx}, 'rest', this)" 
                           class="w-full bg-gray-700 text-gray-300 text-center rounded border border-gray-600 p-1" ${inputAttrs}>
                </div>
                <div class="col-span-1 text-center">
                    <button onclick="removeCircuitSet('${circuitKey}', ${ex.orderKey}, ${sIdx})" class="text-red-500 hover:text-white text-xs font-bold px-2" ${buttonAttrs}>✕</button>
                </div>
            </div>
            `;
    }).join('');

    const addSetButton = allowSetEditing
        ? `<button onclick="addCircuitSet('${circuitKey}', ${ex.orderKey})" class="mt-3 text-xs flex items-center gap-1 text-blue-400 hover:text-white transition w-full justify-center border border-dashed border-gray-700 p-1 rounded hover:border-blue-400"><span class="text-lg">+</span> Add Set</button>`
        : '';

    return `
            <div class="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden" data-exercise-id="${ex.groupId}">
                <div class="p-4 bg-gray-800 border-b border-gray-700 flex gap-4 items-start">
                    <img src="${ex.img}" class="w-16 h-16 rounded object-cover bg-black">
                    <div class="flex-grow">
                        <div class="flex justify-between">
                            <div class="flex items-center gap-2">
                                ${selectionHtml}
                                <h3 class="font-bold text-lg text-white">${ex.title}</h3>
                                <a href="/exercise/${ex.groupId}" target="_blank" class="text-gray-400 hover:text-blue-400 transition" title="Show Details">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </a>
                            </div>
                            <div class="flex gap-2">
                                ${moveButtons}
                                ${removeButton}
                            </div>
                        </div>
                        <div class="flex gap-3 mt-2">
                            <select onchange="updateCircuitExercise('${circuitKey}', ${ex.orderKey}, 'selectedVariantId', this.value)" class="bg-gray-900 text-xs text-white border border-gray-600 rounded p-1 max-w-[150px]">${variantsHtml}</select>
                            <select onchange="updateCircuitExercise('${circuitKey}', ${ex.orderKey}, 'selectedPresetId', this.value)" class="bg-gray-900 text-xs text-green-400 border border-gray-600 rounded p-1 font-bold">${presetsHtml}</select>
                        </div>
                        ${renderWorkoutBadges(ex)}
                        ${unilateralWarning}
                    </div>
                </div>
                
                <div class="p-4">
                    <div class="grid grid-cols-12 gap-2 text-xs uppercase text-gray-500 font-bold mb-2 px-1">
                        <div class="col-span-1 text-center">#</div>
                        <div class="col-span-3">Target (${rules.minR}-${rules.maxR})</div>
                        <div class="col-span-2">${rules.label} (${rules.minW}-${rules.maxW})</div>
                        <div class="col-span-3">Mode</div>
                        <div class="col-span-2">Rest (${rules.minRest}-${rules.maxRest}s)</div>
                        <div class="col-span-1"></div>
                    </div>
                    
                    <div class="space-y-2">
                        ${setRows}
                    </div>
                    ${addSetButton}
                </div>
            </div>
        `;
}

function renderCircuitCardGroup(label, circuitKey, exercises, actionsHtml, options = {}) {
    const rounds = options.rounds;
    const isTarget = options.isTarget === true;
    const enableTarget = options.enableTarget === true;
    const containerClasses = [
        'bg-gray-900/70',
        'rounded-xl',
        'border',
        'border-blue-900/60',
        'p-3',
        'space-y-4'
    ];
    if (isTarget) {
        containerClasses.push('ring-2', 'ring-yellow-400', 'border-yellow-500/70', 'bg-yellow-500/5');
    }
    const containerAttrs = [];
    if (enableTarget && circuitKey) {
        containerAttrs.push(`onclick="handleCircuitContainerClick(event, '${circuitKey}')"`);
    }
    const cards = exercises.map((ex, index) => {
        return renderCircuitExerciseCard(circuitKey, ex, {
            allowSelection: options.allowSelection,
            allowReorder: options.allowReorder,
            allowRemove: options.allowRemove,
            allowSetEditing: options.allowSetEditing,
            orderIndex: index,
            total: exercises.length,
        });
    }).join('');
    const roundsLabel = rounds ? ` (x${rounds})` : '';
    const footerHtml = options.footerHtml ? `<div>${options.footerHtml}</div>` : '';
    return `
            <div class="${containerClasses.join(' ')}" ${containerAttrs.join(' ')}>
                <div class="flex items-center justify-between">
                    <div class="text-sm font-bold text-blue-300">${label}${roundsLabel}</div>
                    <div class="flex gap-2">${actionsHtml || ''}</div>
                </div>
                <div class="space-y-4">
                    ${cards}
                </div>
                ${footerHtml}
            </div>
        `;
}

function getSetGroups(ex) {
    if (!ex.isUnilateral) {
        return ex.sets.map(set => [set]);
    }
    const groups = [];
    for (let i = 0; i < ex.sets.length; i += 2) {
        groups.push(ex.sets.slice(i, i + 2));
    }
    return groups;
}

function cloneExerciseForCircuit(ex, setsGroup) {
    return {
        ...ex,
        internalId: Date.now() + Math.random(),
        sets: setsGroup.map(set => ({ ...set })),
    };
}

function cloneExerciseEntry(ex) {
    return {
        ...ex,
        internalId: Date.now() + Math.random(),
        sets: (ex.sets || []).map(set => ({ ...set })),
    };
}

function renderBuilder() {
    const container = document.getElementById('builder-area');
    container.innerHTML = '';

    if (workoutData.length === 0) {
        container.innerHTML = `<div id="empty-state" class="flex flex-col items-center justify-center h-full text-gray-500 opacity-50"><p>Select exercises from the library</p></div>`;
        document.getElementById('total-stats').innerText = "0 Exercises";
        updateSelectionCount();
        return;
    }

    document.getElementById('total-stats').innerText = `${workoutData.length} Exercises`;

    const blocks = getWorkoutBlocks();
    updatePendingCircuitUI();
    expandedCircuits.forEach(index => {
        if (!getCircuitBlockByIndex(index, blocks)) {
            expandedCircuits.delete(index);
        }
    });
    if (condensedView) {
        blocks.forEach((block) => {
            if (block.type === 'circuit') {
                const blockKey = block.blockIndex;
                const circuitLabel = getCircuitDisplayLabel(blockKey);
                const rows = buildCircuitRowsFromDetected(workoutData, block.start, block.cycleLen, block.rounds);
                const canMoveUp = blockKey > 0;
                const canMoveDown = blockKey < blocks.length - 1;
                const circuitKey = String(blockKey);
                const moveActions = `
                        <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="startAddToCircuit(${blockKey})">Add item</button>
                        <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="addCircuitRound(${blockKey})">Add round</button>
                        <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="removeCircuitRound(${blockKey})">Remove round</button>
                        <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="moveCircuitBlock(${blockKey}, -1)" ${canMoveUp ? '' : 'disabled'}>Up</button>
                        <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="moveCircuitBlock(${blockKey}, 1)" ${canMoveDown ? '' : 'disabled'}>Down</button>
                        <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="removeCircuitBlock(${blockKey})">Delete</button>
                    `;
                container.insertAdjacentHTML('beforeend', renderCircuitTable(circuitLabel, block.rounds, rows, moveActions, {
                    showImages: false,
                    allowRowReorder: true,
                    circuitKey,
                }));
            } else {
                container.insertAdjacentHTML('beforeend', renderCondensedRow(workoutData[block.index], block.index));
            }
        });
        updateSelectionCount();
        return;
    }

    const renderExerciseCard = (ex, exIndex) => {
        const card = document.createElement('div');
        card.className = 'bg-gray-900 rounded-lg border border-gray-700 overflow-hidden';
        card.dataset.exerciseId = ex.groupId;

        // Rules für aktuelles Preset laden
        const rules = getRules(ex);

        let variantsHtml = ex.variants.map(v =>
            `<option value="${v.id}" ${v.id == ex.selectedVariantId ? 'selected' : ''}>Coach ${v.coach ? v.coach.name : 'Standard'}</option>`
        ).join('');

        let presetsHtml = `
                <option value="-1" ${ex.selectedPresetId == -1 ? 'selected' : ''}>Customize (KG)</option>
                <option value="1" ${ex.selectedPresetId == 1 ? 'selected' : ''}>Gain Muscle (RM)</option>
                <option value="3" ${ex.selectedPresetId == 3 ? 'selected' : ''}>Stamina (RM)</option>
                <option value="5" ${ex.selectedPresetId == 5 ? 'selected' : ''}>Strength (RM)</option>
            `;

        const unilateralWarning = ex.isUnilateral ? `<p class="text-xs text-yellow-400 mt-1">Unilateral: L/R Sets</p>` : '';

        card.innerHTML = `
                <div class="p-4 bg-gray-800 border-b border-gray-700 flex gap-4 items-start">
                    <img src="${ex.img}" class="w-16 h-16 rounded object-cover bg-black">
                    <div class="flex-grow">
                        <div class="flex justify-between">
                            <div class="flex items-center gap-2">
                                <input type="checkbox" class="h-4 w-4" ${selectedExerciseIds.has(ex.internalId) ? 'checked' : ''} onchange="toggleExerciseSelection('${ex.internalId}', this.checked)">
                                <h3 class="font-bold text-lg text-white">${ex.title}</h3>
                                <a href="/exercise/${ex.groupId}" target="_blank" class="text-gray-400 hover:text-blue-400 transition" title="Show Details">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </a>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="moveEx(${exIndex}, -1)" class="text-gray-400 hover:text-white disabled:opacity-30" ${exIndex === 0 ? 'disabled' : ''} title="Move Up">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                                </button>
                                <button onclick="moveEx(${exIndex}, 1)" class="text-gray-400 hover:text-white disabled:opacity-30" ${exIndex === workoutData.length - 1 ? 'disabled' : ''} title="Move Down">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                </button>
                                <button onclick="removeEx(${exIndex})" class="text-red-500 hover:text-red-400 text-sm ml-2">✖ Remove</button>
                            </div>
                        </div>
                        <div class="flex gap-3 mt-2">
                            <select onchange="updateEx(${exIndex}, 'selectedVariantId', this.value)" class="bg-gray-900 text-xs text-white border border-gray-600 rounded p-1 max-w-[150px]">${variantsHtml}</select>
                            <select onchange="updateEx(${exIndex}, 'selectedPresetId', this.value)" class="bg-gray-900 text-xs text-green-400 border border-gray-600 rounded p-1 font-bold">${presetsHtml}</select>
                        </div>
                        ${renderWorkoutBadges(ex)}
                        ${unilateralWarning}
                    </div>
                </div>
                
                <div class="p-4">
                    <div class="grid grid-cols-12 gap-2 text-xs uppercase text-gray-500 font-bold mb-2 px-1">
                        <div class="col-span-1 text-center">#</div>
                        <div class="col-span-3">Target (${rules.minR}-${rules.maxR})</div>
                        <div class="col-span-2">${rules.label} (${rules.minW}-${rules.maxW})</div>
                        <div class="col-span-3">Mode</div>
                        <div class="col-span-2">Rest (${rules.minRest}-${rules.maxRest}s)</div>
                        <div class="col-span-1"></div>
                    </div>
                    
                    <div class="space-y-2">
                        ${ex.sets.map((set, sIdx) => {
            let setDisplay = "";
            let sideLabel = "";

            if (ex.isUnilateral) {
                // For unilateral, we display sets as L1, R1, L2, R2...
                // sIdx is the index in the sets array.
                // If sIdx is even (0, 2, 4...), it's Left.
                // If sIdx is odd (1, 3, 5...), it's Right.
                const realSetNum = Math.floor(sIdx / 2) + 1;
                const isLeft = sIdx % 2 === 0;
                setDisplay = `${realSetNum}`;
                sideLabel = isLeft ? `<span class="text-green-400 font-bold mr-1">L</span>` : `<span class="text-blue-400 font-bold mr-1">R</span>`;
            } else {
                setDisplay = sIdx + 1;
            }

            return `
                            <div class="grid grid-cols-12 gap-2 items-center bg-gray-800/50 rounded p-1">
                                <div class="col-span-1 text-center text-gray-400 font-mono flex justify-center items-center">${sideLabel}${setDisplay}</div>
                                
                                <div class="col-span-3 flex gap-1">
                                    <input type="number" 
                                           min="${rules.minR}" max="${rules.maxR}" step="1"
                                           value="${set.reps}" 
                                           onchange="validateAndSet(${exIndex}, ${sIdx}, 'reps', this)" 
                                           class="w-full bg-gray-700 text-white text-center rounded border border-gray-600 p-1">
                                    <button onclick="toggleUnit(${exIndex}, ${sIdx})" class="px-1 text-[10px] bg-gray-700 text-gray-400 rounded w-8 border border-gray-600">${set.unit === 'reps' ? 'Rep' : 'Sec'}</button>
                                </div>
                                <div class="col-span-2">
                                    <input type="number" 
                                           min="${rules.minW}" max="${rules.maxW}" step="${rules.step}"
                                           value="${set.weight}" 
                                           onchange="validateAndSet(${exIndex}, ${sIdx}, 'weight', this)" 
                                           class="w-full bg-gray-700 ${ex.selectedPresetId != -1 ? 'text-yellow-400 font-bold' : 'text-white'} text-center rounded border border-gray-600 p-1">
                                </div>
                                <div class="col-span-3">
                                    <select onchange="updateSet(${exIndex}, ${sIdx}, 'mode', this.value)" class="w-full bg-gray-700 text-white text-[10px] rounded border border-gray-600 p-1">
                                        <option value="1" ${set.mode == 1 ? 'selected' : ''}>Standard</option>
                                        <option value="2" ${set.mode == 2 ? 'selected' : ''}>Chains</option>
                                        <option value="3" ${set.mode == 3 ? 'selected' : ''}>Eccentric</option>
                                    </select>
                                </div>
                                <div class="col-span-2">
                                    <input type="number" 
                                           min="${rules.minRest}" max="${rules.maxRest}" step="5"
                                           value="${set.rest}" 
                                           onchange="validateAndSet(${exIndex}, ${sIdx}, 'rest', this)" 
                                           class="w-full bg-gray-700 text-gray-300 text-center rounded border border-gray-600 p-1">
                                </div>
                                <div class="col-span-1 text-center">
                                    <button onclick="removeSet(${exIndex}, ${sIdx})" class="text-red-500 hover:text-white text-xs font-bold px-2">✕</button>
                                </div>
                            </div>
                            `;
        }).join('')}
                    </div>
                    <button onclick="addSet(${exIndex})" class="mt-3 text-xs flex items-center gap-1 text-blue-400 hover:text-white transition w-full justify-center border border-dashed border-gray-700 p-1 rounded hover:border-blue-400"><span class="text-lg">+</span> Add Set</button>
                </div>
            `;
        container.appendChild(card);
    };

    blocks.forEach((block) => {
        if (block.type === 'circuit') {
            const blockKey = block.blockIndex;
            const circuitLabel = getCircuitDisplayLabel(blockKey);
            if (expandedCircuits.has(blockKey)) {
                const canMoveUp = blockKey > 0;
                const canMoveDown = blockKey < blocks.length - 1;
                const header = `
                        <div class="bg-gray-900/70 rounded-xl border border-blue-900/60 p-3 mb-4 ${pendingCircuitIndex === blockKey ? 'ring-2 ring-yellow-400 border-yellow-500/70 bg-yellow-500/5' : ''}">
                            <div class="flex items-center justify-between">
                                <div class="text-sm font-bold text-blue-300">${circuitLabel} (x${block.rounds})</div>
                                <div class="flex gap-2">
                                    <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="startAddToCircuit(${blockKey})">Add item</button>
                                    <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="addCircuitRound(${blockKey})">Add round</button>
                                    <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="removeCircuitRound(${blockKey})">Remove round</button>
                                    <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="moveCircuitBlock(${blockKey}, -1)" ${canMoveUp ? '' : 'disabled'}>Up</button>
                                    <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="moveCircuitBlock(${blockKey}, 1)" ${canMoveDown ? '' : 'disabled'}>Down</button>
                                    <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="undoCircuit(${blockKey})">Undo circuit</button>
                                    <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="removeCircuitBlock(${blockKey})">Delete</button>
                                </div>
                            </div>
                            <button class="mt-3 w-full text-xs px-2 py-2 rounded border border-dashed border-blue-800 text-blue-300 hover:text-white hover:border-blue-400" onclick="startAddToCircuit(${blockKey})">Add exercise to this circuit</button>
                        </div>
                    `;
                container.insertAdjacentHTML('beforeend', header);
                for (let i = block.start; i < block.start + block.length; i += 1) {
                    renderExerciseCard(workoutData[i], i);
                }
            } else {
                const exercises = buildCircuitExerciseViews(block);
                if (exercises.length) {
                    const canMoveUp = blockKey > 0;
                    const canMoveDown = blockKey < blocks.length - 1;
                    const actions = `
                            <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="startAddToCircuit(${blockKey})">Add item</button>
                            <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="addCircuitRound(${blockKey})">Add round</button>
                            <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="removeCircuitRound(${blockKey})">Remove round</button>
                            <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="moveCircuitBlock(${blockKey}, -1)" ${canMoveUp ? '' : 'disabled'}>Up</button>
                            <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="moveCircuitBlock(${blockKey}, 1)" ${canMoveDown ? '' : 'disabled'}>Down</button>
                            <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="undoCircuit(${blockKey})">Undo circuit</button>
                            <button class="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="removeCircuitBlock(${blockKey})">Delete</button>
                        `;
                    const footer = `
                            <button class="w-full text-xs px-2 py-2 rounded border border-dashed border-blue-800 text-blue-300 hover:text-white hover:border-blue-400" onclick="startAddToCircuit(${blockKey})">Add exercise to this circuit</button>
                        `;
                    container.insertAdjacentHTML('beforeend', renderCircuitCardGroup(circuitLabel, String(blockKey), exercises, actions, {
                        rounds: block.rounds,
                        allowSelection: true,
                        allowReorder: true,
                        allowRemove: true,
                        allowSetEditing: true,
                        isTarget: pendingCircuitIndex === blockKey,
                        enableTarget: true,
                        footerHtml: footer,
                    }));
                }
            }
            return;
        }
        renderExerciseCard(workoutData[block.index], block.index);
    });
    updateSelectionCount();
}

window.toggleExerciseSelection = (internalId, checked) => {
    const id = Number(internalId);
    if (checked) {
        selectedExerciseIds.add(id);
    } else {
        selectedExerciseIds.delete(id);
    }
    updateSelectionCount();
};

function updateSelectionCount() {
    const el = document.getElementById('selected-count');
    if (el) {
        el.textContent = `${selectedExerciseIds.size} selected`;
    }
}

function setCircuitTarget(blockIndex) {
    if (blockIndex === null || blockIndex === undefined || Number.isNaN(Number(blockIndex))) {
        pendingCircuitIndex = null;
    } else {
        pendingCircuitIndex = Number(blockIndex);
    }
    updatePendingCircuitUI();
}

window.toggleCircuitTarget = (blockIndex) => {
    const index = blockIndex === null || blockIndex === undefined ? null : Number(blockIndex);
    if (index !== null && pendingCircuitIndex === index) {
        pendingCircuitIndex = null;
        updatePendingCircuitUI();
        renderBuilder();
        return;
    }
    setCircuitTarget(index);
    renderBuilder();
};

window.handleCircuitContainerClick = (event, blockIndex) => {
    if (!event || blockIndex === null || blockIndex === undefined) return;
    const blocked = event.target.closest('button, input, select, textarea, a, svg, path');
    if (blocked) return;
    window.toggleCircuitTarget(blockIndex);
};

function getCircuitDisplayLabel(blockIndex) {
    const index = blockIndex === null || blockIndex === undefined ? null : Number(blockIndex);
    if (index === null || Number.isNaN(index)) return 'Circuit';
    const blocks = getWorkoutBlocks();
    const block = blocks.find(item => item.blockIndex === index);
    if (!block || block.type !== 'circuit') return 'Circuit';
    return `Circuit ${block.displayIndex}`;
}

function getCircuitExerciseViewByOrder(circuitKey, orderKey) {
    const blockIndex = Number(circuitKey);
    const block = getCircuitBlockByIndex(blockIndex);
    if (!block) return null;
    const order = Number(orderKey);
    if (Number.isNaN(order)) return null;
    return buildCircuitExerciseViewFromBlock(block, order);
}

window.toggleCircuitExerciseSelection = (circuitKey, orderKey, checked) => {
    const exercise = getCircuitExerciseViewByOrder(circuitKey, orderKey);
    if (!exercise) return;
    exercise.entryIndexes.forEach(idx => {
        const entry = workoutData[idx];
        if (!entry) return;
        if (checked) {
            selectedExerciseIds.add(entry.internalId);
        } else {
            selectedExerciseIds.delete(entry.internalId);
        }
    });
    updateSelectionCount();
};

window.validateAndSetCircuit = (circuitKey, orderKey, sIdx, field, input) => {
    const exercise = getCircuitExerciseViewByOrder(circuitKey, orderKey);
    if (!exercise) return;
    const map = exercise.setMap[sIdx];
    if (!map) return;
    const entry = workoutData[map.entryIndex];
    if (!entry) return;
    const rules = getRules(entry);
    let val = parseInt(input.value);

    let min = 0, max = 999;
    if (field === 'weight') { min = rules.minW; max = rules.maxW; }
    if (field === 'reps') { min = rules.minR; max = rules.maxR; }
    if (field === 'rest') { min = rules.minRest; max = rules.maxRest; }

    if (isNaN(val)) val = min;
    if (val < min) val = min;
    if (val > max) val = max;

    input.value = val;
    entry.sets[map.setIndex][field] = val;
};

window.updateCircuitSet = (circuitKey, orderKey, sIdx, field, val) => {
    const exercise = getCircuitExerciseViewByOrder(circuitKey, orderKey);
    if (!exercise) return;
    const map = exercise.setMap[sIdx];
    if (!map) return;
    const entry = workoutData[map.entryIndex];
    if (!entry) return;
    entry.sets[map.setIndex][field] = val;
};

window.toggleCircuitUnit = (circuitKey, orderKey, sIdx) => {
    const exercise = getCircuitExerciseViewByOrder(circuitKey, orderKey);
    if (!exercise) return;
    const map = exercise.setMap[sIdx];
    if (!map) return;
    const entry = workoutData[map.entryIndex];
    if (!entry) return;
    const current = entry.sets[map.setIndex].unit;
    entry.sets[map.setIndex].unit = current === 'reps' ? 'sec' : 'reps';
    renderBuilder();
};

window.updateCircuitExercise = (circuitKey, orderKey, field, val) => {
    const exercise = getCircuitExerciseViewByOrder(circuitKey, orderKey);
    if (!exercise) return;
    const entryIndexes = exercise.entryIndexes;
    if (field === 'selectedPresetId' || field === 'selectedVariantId') {
        val = parseInt(val);
    }
    entryIndexes.forEach(idx => {
        const entry = workoutData[idx];
        if (entry) {
            entry[field] = val;
        }
    });

    if (field === 'selectedPresetId') {
        const first = workoutData[entryIndexes[0]];
        if (!first) return;
        const rules = getRules(first);
        entryIndexes.forEach(idx => {
            const entry = workoutData[idx];
            if (!entry) return;
            entry.sets.forEach(set => {
                set.weight = rules.defW;
                set.reps = rules.defR;
                set.rest = rules.defRest;
            });
        });
        renderBuilder();
    }
};

window.addCircuitSet = (circuitKey, orderKey) => {
    const exercise = getCircuitExerciseViewByOrder(circuitKey, orderKey);
    if (!exercise) return;
    const entryIndexes = exercise.entryIndexes;
    const baseEntry = workoutData[entryIndexes[entryIndexes.length - 1]] || workoutData[entryIndexes[0]];
    if (!baseEntry) return;
    const rules = getRules(baseEntry);
    const newSetTemplate = {
        reps: rules.defR,
        weight: rules.defW,
        mode: 1,
        rest: rules.defRest,
        unit: 'reps'
    };
    const applyAll = entryIndexes.length > 1
        ? window.confirm('Add a set to all exercises for this circuit?')
        : false;
    if (applyAll) {
        workoutData = Circuits.appendSetToCircuit(workoutData, Number(circuitKey));
    } else {
        const blockIndex = Number(circuitKey);
        const block = getCircuitBlockByIndex(blockIndex);
        if (!block) return;
        const seedEntry = workoutData[entryIndexes[0]] || baseEntry;
        const clone = cloneExerciseEntry(seedEntry);
        clone.sets.push({ ...newSetTemplate });
        if (clone.isUnilateral) {
            clone.sets.push({ ...newSetTemplate });
        }
        workoutData = Circuits.appendEntryToCircuitBlock(workoutData, blockIndex, clone);
    }
    renderBuilder();
};

window.removeCircuitSet = (circuitKey, orderKey, sIdx) => {
    const exercise = getCircuitExerciseViewByOrder(circuitKey, orderKey);
    if (!exercise) return;
    const map = exercise.setMap[sIdx];
    if (!map) return;
    const applyAll = exercise.entryIndexes.length > 1
        ? window.confirm('Remove this set from all exercises in this circuit?')
        : false;
    if (applyAll) {
        workoutData = Circuits.deleteSetFromCircuit(workoutData, circuitKey, sIdx);
    } else {
        const targetIndex = map.entryIndex;
        workoutData = Circuits.removeWorkoutEntryAtIndex(workoutData, targetIndex);
    }
    renderBuilder();
};

window.addCircuitRound = (blockIndex) => {
    const index = Number(blockIndex);
    const block = getCircuitBlockByIndex(index);
    if (!block) return;
    workoutData = Circuits.appendSetToCircuit(workoutData, index);
    renderBuilder();
};

window.removeCircuitRound = (blockIndex) => {
    const index = Number(blockIndex);
    const block = getCircuitBlockByIndex(index);
    if (!block) return;
    const roundIndex = Math.max(0, block.rounds - 1);
    workoutData = Circuits.deleteSetFromCircuit(workoutData, index, roundIndex);
    renderBuilder();
};

window.removeCircuitExercise = (circuitKey, orderKey) => {
    const blockIndex = Number(circuitKey);
    const block = getCircuitBlockByIndex(blockIndex);
    if (!block) return;
    const removePos = Number(orderKey);
    if (Number.isNaN(removePos)) return;
    withWorkoutLog(`removeCircuitExercise:${blockIndex}:${orderKey}`, () => {
        workoutData = Circuits.deleteExerciseFromCircuit(workoutData, blockIndex, removePos);
    });
    renderBuilder();
};

window.moveCircuitExercise = (circuitKey, orderKey, direction) => {
    const blockIndex = Number(circuitKey);
    const block = getCircuitBlockByIndex(blockIndex);
    if (!block) return;
    const fromPos = Number(orderKey);
    const toPos = fromPos + direction;
    if (Number.isNaN(fromPos) || Number.isNaN(toPos)) return;
    if (toPos < 0 || toPos >= block.cycleLen) return;
    withWorkoutLog(`moveCircuitExercise:${blockIndex}:${orderKey}:${direction}`, () => {
        workoutData = Circuits.reorderCircuitItems(workoutData, blockIndex, fromPos, toPos);
    });
    renderBuilder();
};

window.moveCircuitBlock = (blockIndex, direction) => {
    const index = Number(blockIndex);
    if (Number.isNaN(index)) return;
    const blocks = getWorkoutBlocks();
    const block = getCircuitBlockByIndex(index, blocks);
    if (!block) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    withWorkoutLog(`moveCircuitBlock:${index}:${direction}`, () => {
        workoutData = Circuits.moveCircuit(workoutData, index, targetIndex);
        if (pendingCircuitIndex !== null) {
            pendingCircuitIndex = null;
        }
    });
    renderBuilder();
};

window.removeCircuitBlock = (blockIndex) => {
    const index = Number(blockIndex);
    const block = getCircuitBlockByIndex(index);
    if (!block) return;
    withWorkoutLog(`removeCircuitBlock:${index}`, () => {
        workoutData = Circuits.removeCircuit(workoutData, index);
        if (pendingCircuitIndex === index) {
            pendingCircuitIndex = null;
        }
    });
    renderBuilder();
};

window.makeCircuitFromSelected = () => {
    if (selectedExerciseIds.size < 2) {
        return alert("Select at least two exercises to create a circuit.");
    }
    const selected = [];
    const selectedIndices = [];
    workoutData.forEach((ex, idx) => {
        if (selectedExerciseIds.has(ex.internalId)) {
            selected.push(ex);
            selectedIndices.push(idx);
        }
    });
    if (selected.length < 2) {
        return alert("Select at least two exercises to create a circuit.");
    }

    withWorkoutLog('makeCircuitFromSelected', () => {
        workoutData = Circuits.replaceExercisesWithCircuit(workoutData, selectedIndices);
    });
    selectedExerciseIds.clear();
    updateSelectionCount();
    pendingCircuitIndex = null;
    updatePendingCircuitUI();
    renderBuilder();
};

window.toggleCircuitExpanded = (blockIndex) => {
    const index = Number(blockIndex);
    if (Number.isNaN(index)) return;
    if (expandedCircuits.has(index)) {
        expandedCircuits.delete(index);
    } else {
        expandedCircuits.add(index);
    }
    renderBuilder();
};

window.startAddToCircuit = (blockIndex) => {
    setCircuitTarget(blockIndex);
    renderBuilder();
};

function updatePendingCircuitUI() {
    const el = document.getElementById('pending-circuit');
    if (!el) return;
    if (pendingCircuitIndex !== null) {
        const label = getCircuitDisplayLabel(pendingCircuitIndex);
        el.classList.remove('hidden');
        el.innerHTML = `Adding to ${label}: <button class="ml-2 text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="addSelectedToCircuit()">Add selected</button>
                <button class="ml-2 text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600" onclick="clearPendingCircuit()">Cancel</button>`;
    } else {
        el.classList.add('hidden');
        el.textContent = '';
    }
}

window.clearPendingCircuit = () => {
    pendingCircuitIndex = null;
    updatePendingCircuitUI();
};

window.addSelectedToCircuit = () => {
    if (pendingCircuitIndex === null) return;
    if (selectedExerciseIds.size === 0) {
        return alert("Select exercises to add to the circuit.");
    }
    const targetBlock = getCircuitBlockByIndex(pendingCircuitIndex);
    if (!targetBlock) {
        pendingCircuitIndex = null;
        updatePendingCircuitUI();
        return;
    }
    withWorkoutLog('addSelectedToCircuit', () => {
        const selected = workoutData.filter(ex => selectedExerciseIds.has(ex.internalId));
        selected.forEach(ex => {
            addExerciseToCircuit(pendingCircuitIndex, ex);
        });
    });
    selectedExerciseIds.clear();
    updateSelectionCount();
    pendingCircuitIndex = null;
    updatePendingCircuitUI();
    renderBuilder();
};

window.undoCircuit = (blockIndex) => {
    withWorkoutLog('undoCircuit', () => {
        const index = Number(blockIndex);
        workoutData = Circuits.undoCircuit(workoutData, index);
        expandedCircuits.clear();
        if (pendingCircuitIndex === index) {
            pendingCircuitIndex = null;
        }
    });
    updatePendingCircuitUI();
    renderBuilder();
};

window.ungroupCircuit = window.undoCircuit;

window.editExerciseFromCircuit = (groupId) => {
    condensedView = false;
    const toggle = document.getElementById('condensed-toggle');
    if (toggle) toggle.checked = false;
    const target = String(groupId);
    for (let i = 0; i < workoutData.length; i += 1) {
        const entry = workoutData[i];
        if (!entry || String(entry.groupId) !== target) continue;
        const address = Circuits.workoutIndexToCircuitIndex(workoutData, i);
        if (address.isCircuit && address.circuitIndex !== null) {
            expandedCircuits.add(address.circuitIndex);
            break;
        }
    }
    renderBuilder();
    setTimeout(() => {
        const el = document.querySelector(`[data-exercise-id="${groupId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-blue-500');
            setTimeout(() => {
                el.classList.remove('ring-2', 'ring-blue-500');
            }, 1200);
        }
    }, 0);
};

window.editExerciseByIndex = (exIndex) => {
    const index = Number(exIndex);
    if (Number.isNaN(index) || index < 0 || index >= workoutData.length) return;
    condensedView = false;
    const toggle = document.getElementById('condensed-toggle');
    if (toggle) toggle.checked = false;
    const address = Circuits.workoutIndexToCircuitIndex(workoutData, index);
    if (address.isCircuit && address.circuitIndex !== null) {
        expandedCircuits.add(address.circuitIndex);
    }
    renderBuilder();
    setTimeout(() => {
        const entry = workoutData[index];
        if (!entry) return;
        const el = document.querySelector(`[data-exercise-id="${entry.groupId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-blue-500');
            setTimeout(() => {
                el.classList.remove('ring-2', 'ring-blue-500');
            }, 1200);
        }
    }, 0);
};

// --- LOGIC ---

// Validierung und Update
window.validateAndSet = (exIdx, sIdx, field, input) => {
    withWorkoutLog(`validateAndSet:${exIdx}:${sIdx}:${field}`, () => {
        const ex = workoutData[exIdx];
        const rules = getRules(ex);
        let val = parseInt(input.value);

        // Grenzen prüfen
        let min = 0, max = 999;
        if (field === 'weight') { min = rules.minW; max = rules.maxW; }
        if (field === 'reps') { min = rules.minR; max = rules.maxR; }
        if (field === 'rest') { min = rules.minRest; max = rules.maxRest; }

        if (isNaN(val)) val = min;
        if (val < min) val = min;
        if (val > max) val = max;

        // Wert zurückschreiben ins Input und Data
        input.value = val;
        workoutData[exIdx].sets[sIdx][field] = val;
    });
};

window.openPromptGenerator = () => {
    document.getElementById('prompt-modal').classList.remove('hidden');
    document.getElementById('prompt-modal').classList.add('flex');
    resetPromptModal();
};

window.resetPromptModal = () => {
    document.getElementById('prompt-step-1').classList.remove('hidden');
    document.getElementById('prompt-step-1').classList.add('flex');
    document.getElementById('prompt-step-2').classList.add('hidden');
    document.getElementById('prompt-step-2').classList.remove('flex');
    document.getElementById('prompt-modal-title').innerText = "Generate AI Prompt";
};

window.exportJSON = () => {
    if (workoutData.length === 0) return alert("Plan is empty!");

    const exportObj = {
        name: document.getElementById('plan-name').value || "Custom Workout",
        exercises: workoutData.map(ex => ({
            id: ex.groupId,
            title: ex.title,
            sets: ex.sets.map(s => ({
                reps: s.reps,
                weight: s.weight,
                mode: s.mode,
                rest: s.rest
            }))
        }))
    };

    const jsonStr = JSON.stringify(exportObj, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
        alert("Workout JSON copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert("Failed to copy to clipboard. Check console.");
    });
};

window.moveEx = (index, direction) => {
    withWorkoutLog(`moveEx:${index}:${direction}`, () => {
        if (direction === -1 && index > 0) {
            [workoutData[index], workoutData[index - 1]] = [workoutData[index - 1], workoutData[index]];
        } else if (direction === 1 && index < workoutData.length - 1) {
            [workoutData[index], workoutData[index + 1]] = [workoutData[index + 1], workoutData[index]];
        }
    });
    renderBuilder();
};

window.generateFullPrompt = async () => {
    const userRequest = document.getElementById('user-request').value;
    if (!userRequest.trim()) return alert("Please describe your workout goal.");

    // Save Custom Instructions
    const currentCustomInstruction = document.getElementById('prompt-custom-instruction').value;
    try {
        await fetch('/settings/custom_instruction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction: currentCustomInstruction })
        });
    } catch (e) {
        console.error("Failed to save custom instruction", e);
    }

    // Get selected categories
    const selectedCats = new Set();
    document.querySelectorAll('.prompt-cat-filter:checked').forEach(cb => {
        const ids = (cb.dataset.filterIds || cb.value || '').split(',');
        ids.forEach(id => {
            const parsed = parseInt(id, 10);
            if (!Number.isNaN(parsed)) {
                selectedCats.add(parsed);
            }
        });
    });

    const muscleMap = {
        11: 'Chest',
        12: 'Shoulder',
        13: 'Back',
        14: 'Glutes',
        15: 'Legs',
        16: 'Arms',
        17: 'Abs'
    };

    let prompt = `You are a professional fitness coach using the Speediance Gym Monster.
Your task is to create a custom workout plan based on the user's request: "${userRequest}"

AVAILABLE EXERCISES:
You must ONLY use exercises from the following list. Use the exact 'id'.
Format: [ID] Title (Category: <Category>, Focus: <Primary>, Target: <Main>[, <Aux>])

MODES:
- 1: Standard (Normal reps)
- 2: Chains (Resistance increases at the top)
- 3: Eccentric (Resistance increases during the lowering phase)
Use these modes appropriately based on the goal (e.g., Eccentric for hypertrophy/control).

`;

    if (currentCustomInstruction && currentCustomInstruction.trim()) {
        prompt += `CUSTOM INSTRUCTIONS:\n${currentCustomInstruction}\n\n`;
    }

    let addedCount = 0;
    fullLibrary.forEach(ex => {
        // Filter by category
        if (!selectedCats.has(ex.category_id)) return;

        const focus = muscleMap[ex.trainingPartId2] || 'General';
        let target = ex.mainMuscleGroupName || '';
        if (ex.auxiliaryMuscleGroupList && ex.auxiliaryMuscleGroupList.length > 0) {
            const aux = ex.auxiliaryMuscleGroupList.map(a => a.muscleGroupName).join(', ');
            if (target) target += ', ' + aux;
            else target = aux;
        }
        prompt += `[${ex.id}] ${ex.title} (Category: ${ex.category_name}, Focus: ${focus}, Target: ${target})\n`;
        addedCount++;
    });

    if (addedCount === 0) {
        return alert("No exercises selected! Please check at least one category.");
    }

    prompt += `
OUTPUT FORMAT:
You must output a JSON object with the following structure:
{
  "name": "Workout Name",
  "exercises": [
    {
      "id": "Exercise ID",
      "sets": [
        { "reps": 10, "weight": 10, "mode": 1, "rest": 60 }
      ]
    }
  ]
}
`;

    document.getElementById('prompt-text').value = prompt;

    // Switch to Step 2
    document.getElementById('prompt-step-1').classList.add('hidden');
    document.getElementById('prompt-step-1').classList.remove('flex');
    document.getElementById('prompt-step-2').classList.remove('hidden');
    document.getElementById('prompt-step-2').classList.add('flex');
    document.getElementById('prompt-modal-title').innerText = "Your AI Prompt is Ready";
};

window.closePromptModal = () => {
    document.getElementById('prompt-modal').classList.add('hidden');
    document.getElementById('prompt-modal').classList.remove('flex');
};

window.copyPrompt = () => {
    const copyText = document.getElementById("prompt-text");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    alert("Prompt copied to clipboard! You can now close this window and then paste this into a LLM like ChatGPT or Claude to generate a workout plan.");
};

window.openImportModal = () => {
    document.getElementById('import-modal').classList.remove('hidden');
    document.getElementById('import-modal').classList.add('flex');
};

window.closeImportModal = () => {
    document.getElementById('import-modal').classList.add('hidden');
    document.getElementById('import-modal').classList.remove('flex');
};

window.processImport = async () => {
    const jsonStr = document.getElementById('import-json').value;
    try {
        const data = JSON.parse(jsonStr);

        if (data.name) {
            document.getElementById('plan-name').value = data.name;
        }

        if (data.exercises && Array.isArray(data.exercises)) {
            // Clear existing
            workoutData = [];

            // Process sequentially to keep order
            for (const ex of data.exercises) {
                const groupId = ex.id;
                const meta = await fetchExerciseMetadata(groupId);

                // Lookup title from fullLibrary
                const libEx = fullLibrary.find(e => e.id == groupId);
                const title = libEx ? libEx.title : (ex.title || "Unknown Exercise");

                // Map sets
                const setsParsed = ex.sets.map(s => ({
                    reps: parseInt(s.reps),
                    weight: parseInt(s.weight),
                    mode: parseInt(s.mode || 1),
                    rest: parseInt(s.rest || 60),
                    unit: 'reps'
                }));

                // Handle Unilateral: If imported sets are just "sets", but exercise is unilateral,
                // we might need to duplicate them for L/R if the LLM didn't provide them explicitly.
                // However, our prompt asks for a simple list.
                // If the exercise is unilateral, the API expects L1, R1, L2, R2 order.
                // If the LLM provides 3 sets, and it's unilateral, we should probably assume these are "pairs" or just raw sets.
                // To be safe, let's assume the LLM provides "per round" sets.
                // So if it says 3 sets, we generate 3 pairs (6 sets) for unilateral.

                let finalSets = [];
                if (meta.isUnilateral) {
                    setsParsed.forEach(s => {
                        finalSets.push({ ...s }); // Left
                        finalSets.push({ ...s }); // Right
                    });
                } else {
                    finalSets = setsParsed;
                }

                workoutData.push({
                    internalId: Date.now() + Math.random(),
                    groupId: parseInt(groupId),
                    title: title,
                    img: meta.variants?.[0]?.img || (libEx ? libEx.img : ""), // Fallback image
                    isUnilateral: meta.isUnilateral,
                    variants: meta.variants,
                    presets: meta.presets,
                    selectedVariantId: meta.variants?.[0]?.id || groupId, // Default to first variant
                    selectedPresetId: -1, // Default to Custom
                    sets: finalSets
                });
            }
            renderBuilder();
            closeImportModal();
            alert("Workout imported successfully!");
        } else {
            alert("Invalid JSON format: Missing 'exercises' array.");
        }

    } catch (e) {
        console.error(e);
        alert("Error parsing JSON: " + e.message);
    }
};

window.updateEx = (exIdx, field, val) => {
    withWorkoutLog(`updateEx:${exIdx}:${field}`, () => {
        // normalize numeric fields coming from <select>
        if (field === 'selectedPresetId' || field === 'selectedVariantId') {
            workoutData[exIdx][field] = parseInt(val);
        } else {
            workoutData[exIdx][field] = val;
        }

        // Wenn Preset geändert wird -> Alle Sets auf neue Defaults setzen!
        if (field === 'selectedPresetId') {
            const rules = getRules(workoutData[exIdx]);
            workoutData[exIdx].sets.forEach(set => {
                set.weight = rules.defW;
                set.reps = rules.defR;
                set.rest = rules.defRest;
            });
        }
    });
    if (field === 'selectedPresetId') {
        renderBuilder();
    }
};

window.updateSet = (exIdx, sIdx, field, val) => {
    withWorkoutLog(`updateSet:${exIdx}:${sIdx}:${field}`, () => {
        const ex = workoutData[exIdx];
        ex.sets[sIdx][field] = val;
    });

    // Sync L/R sets if unilateral?
    // If user changes L, should R update automatically?
    // Usually yes for weight/reps/mode/rest to keep them symmetric by default.
    // But maybe user wants asymmetric?
    // The UI shows them as separate rows, implying they can be different.
    // However, `addSet` adds identical L/R.
    // Let's keep them independent for now as per UI design.
};

window.toggleUnit = (exIdx, sIdx) => {
    withWorkoutLog(`toggleUnit:${exIdx}:${sIdx}`, () => {
        const current = workoutData[exIdx].sets[sIdx].unit;
        workoutData[exIdx].sets[sIdx].unit = current === 'reps' ? 'sec' : 'reps';
    });
    renderBuilder();
};

window.addSet = (exIdx) => {
    withWorkoutLog(`addSet:${exIdx}`, () => {
        const ex = workoutData[exIdx];
        const rules = getRules(ex);

        // Neue Sets bekommen IMMER die Defaults des aktuellen Presets
        const newSetTemplate = {
            reps: rules.defR,
            weight: rules.defW,
            mode: 1,
            rest: rules.defRest,
            unit: 'reps'
        };

        // For UI model, we just push ONE set object.
        // The save logic (api_client) will expand this to L/R if isUnilateral is true.
        // Wait, the UI rendering loop iterates over `ex.sets`.
        // If isUnilateral, the UI rendering loop does:
        // if (ex.isUnilateral) {
        //    const realSetNum = Math.floor(sIdx / 2) + 1;
        //    ...
        // }
        // This implies the UI model expects 2 entries per set for unilateral?
        // Let's check the rendering loop.

        ex.sets.push({ ...newSetTemplate });
        if (ex.isUnilateral) ex.sets.push({ ...newSetTemplate });
    });

    renderBuilder();
};

window.removeSet = (exIdx, sIdx) => {
    withWorkoutLog(`removeSet:${exIdx}:${sIdx}`, () => {
        const ex = workoutData[exIdx];
        if (ex.sets.length <= (ex.isUnilateral ? 2 : 1)) return;

        if (ex.isUnilateral) {
            // Remove both L and R sets
            const pairIndex = Math.floor(sIdx / 2);
            ex.sets.splice(pairIndex * 2, 2);
        } else {
            ex.sets.splice(sIdx, 1);
        }
    });
    renderBuilder();
};
window.removeEx = (exIdx) => {
    withWorkoutLog(`removeEx:${exIdx}`, () => {
        const removed = workoutData.splice(exIdx, 1)[0];
        if (removed && pendingCircuitIndex !== null) {
            pendingCircuitIndex = null;
            updatePendingCircuitUI();
        }
    });
    renderBuilder();
};

window.saveWorkout = async () => {
    const name = document.getElementById('plan-name').value || "Custom Workout";
    if (workoutData.length === 0) return alert("Plan is empty!");

    const payloadExercises = workoutData.map(ex => ({
        groupId: ex.groupId,
        variant_id: ex.selectedVariantId,
        preset_id: ex.selectedPresetId,
        sets: ex.sets.map(s => {
            const newSet = { ...s };
            // If Imperial (1) and Custom Preset (-1), convert LBS -> KG before sending
            if (userUnit === 1 && ex.selectedPresetId == -1) {
                let lbs = parseFloat(newSet.weight);
                let kg = lbs / 2.2;
                newSet.weight = Math.round(kg * 2) / 2;
            }
            return newSet;
        })
    }));

    const res = await fetch('/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: currentTemplateId,
            name: name,
            exercises: payloadExercises
        })
    });

    const json = await res.json();
    if (json.status === 'success') {
        window.location.href = '/';
    } else {
        alert("Error: " + json.message);
    }
};
