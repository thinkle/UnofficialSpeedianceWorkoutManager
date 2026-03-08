/**
 * Equipment grouping configuration for smart filtering.
 * 
 * Groups define categories of related equipment where:
 * - Selections within a group use OR logic
 * - Selections between groups use AND logic  
 * - Special compatibility rules handle equipment substitution
 */

export const EQUIPMENT_GROUPS = [
  {
    id: 'bench',
    label: 'Bench Type',
    items: [
      { id: 'none', label: 'No bench', matchers: [] },
      { id: 'flat', label: 'Flat bench', matchers: ['flat bench', 'bench'] },
      {
        id: 'adjustable',
        label: 'Adjustable bench',
        matchers: ['adjustable bench', 'incline bench', 'decline bench'],
        // Adjustable benches can substitute for flat benches
        compatibleWith: ['flat'],
      },
    ],
  },
  {
    id: 'attachment',
    label: 'Attachments',
    items: [
      { id: 'barbell', label: 'Barbell', matchers: ['barbell'] },
      { id: 'handles', label: 'Handles', matchers: ['handles', 'handle'] },
      { id: 'rope', label: 'Rope', matchers: ['rope', 'tricep rope'] },
      { id: 'ankle', label: 'Ankle strap', matchers: ['ankle', 'ankle strap'] },
      { id: 'dip', label: 'Dip bars', matchers: ['dip', 'dip bars', 'dip bar'] },
    ],
  },
]

/**
 * Check if an exercise's equipment matches the selected filters.
 * 
 * @param {string} equipmentName - Comma-separated equipment names for an exercise
 * @param {Object} selectedFilters - Map of groupId -> Set of selected item IDs
 * @returns {boolean} - True if exercise matches all filter criteria
 */
export function matchesEquipmentFilter(equipmentName, selectedFilters) {
  // No filters = show everything
  if (!selectedFilters || Object.keys(selectedFilters).length === 0) {
    return true
  }

  const normalizedEquipment = (equipmentName || 'standard')
    .toLowerCase()
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  // Special case: if equipment is just "standard" and bench filter has "none" selected
  const isStandardOnly = normalizedEquipment.length === 1 && normalizedEquipment[0] === 'standard'

  // Check each group (AND logic between groups)
  for (const [groupId, selectedIds] of Object.entries(selectedFilters)) {
    if (!selectedIds || selectedIds.size === 0) continue

    const group = EQUIPMENT_GROUPS.find((g) => g.id === groupId)
    if (!group) continue

    // Special handling for bench group with "none" option
    if (groupId === 'bench') {
      const hasNone = selectedIds.has('none')
      const hasOthers = [...selectedIds].some((id) => id !== 'none')

      if (hasNone && !hasOthers) {
        // Only "none" selected - match "standard" equipment or exercises without bench keywords
        if (isStandardOnly) continue
        const hasBench = normalizedEquipment.some((eq) =>
          ['flat bench', 'bench', 'adjustable bench', 'incline bench', 'decline bench'].some(
            (b) => eq.includes(b)
          )
        )
        if (hasBench) return false
        continue
      }
      // If other bench types selected, "none" is ignored (exercises with benches will be shown)
    }

    // Check if exercise matches ANY selected item in this group (OR logic within group)
    const matchesGroup = [...selectedIds].some((selectedId) => {
      if (selectedId === 'none') return false // "none" doesn't match equipment

      const item = group.items.find((i) => i.id === selectedId)
      if (!item) return false

      // Check direct matchers
      const directMatch = normalizedEquipment.some((eq) =>
        item.matchers.some((matcher) => eq.includes(matcher))
      )
      if (directMatch) return true

      // Check compatibility (e.g., adjustable bench can substitute for flat)
      if (item.compatibleWith && item.compatibleWith.length > 0) {
        const compatibleItems = item.compatibleWith
          .map((compatId) => group.items.find((i) => i.id === compatId))
          .filter(Boolean)

        return compatibleItems.some((compatItem) =>
          normalizedEquipment.some((eq) =>
            compatItem.matchers.some((matcher) => eq.includes(matcher))
          )
        )
      }

      return false
    })

    if (!matchesGroup) return false // Must match at least one item in each group
  }

  return true
}

/**
 * Get all unique equipment items from all exercises, categorized by group.
 * Useful for showing counts or hiding empty groups.
 * 
 * @param {Array} exercises - Array of exercise objects
 * @returns {Object} - Map of groupId -> Set of item IDs that exist in exercises
 */
export function getAvailableEquipment(exercises) {
  const available = {}

  EQUIPMENT_GROUPS.forEach((group) => {
    available[group.id] = new Set()
  })

  exercises.forEach((exercise) => {
    const equipmentName = exercise.equipment_name || 'standard'
    const normalized = equipmentName.toLowerCase()

    EQUIPMENT_GROUPS.forEach((group) => {
      group.items.forEach((item) => {
        if (item.matchers.some((matcher) => normalized.includes(matcher))) {
          available[group.id].add(item.id)
        }
      })
    })
  })

  return available
}
