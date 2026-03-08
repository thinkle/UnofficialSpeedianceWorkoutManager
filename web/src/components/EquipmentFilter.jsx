import { useState } from "react";
import { EQUIPMENT_GROUPS } from "../lib/equipmentGroups.js";

/**
 * EquipmentFilter component with grouped checkboxes.
 * Provides smart OR/AND filtering logic across equipment groups.
 */
function EquipmentFilter({ selectedFilters, onChange, disabled = false }) {
  const [expandedGroups, setExpandedGroups] = useState(
    new Set(["bench", "attachment"]),
  );

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleItemToggle = (groupId, itemId) => {
    const newFilters = { ...selectedFilters };

    if (!newFilters[groupId]) {
      newFilters[groupId] = new Set();
    } else {
      newFilters[groupId] = new Set(newFilters[groupId]);
    }

    if (newFilters[groupId].has(itemId)) {
      newFilters[groupId].delete(itemId);
      // Remove empty groups
      if (newFilters[groupId].size === 0) {
        delete newFilters[groupId];
      }
    } else {
      newFilters[groupId].add(itemId);
    }

    onChange(newFilters);
  };

  const getSelectedCount = () => {
    return Object.values(selectedFilters).reduce(
      (total, set) => total + set.size,
      0,
    );
  };

  const selectedCount = getSelectedCount();

  return (
    <div className="equipment-filter">
      {EQUIPMENT_GROUPS.map((group) => {
        const isExpanded = expandedGroups.has(group.id);
        const groupSelectedIds = selectedFilters[group.id] || new Set();

        return (
          <div key={group.id} className="equipment-group">
            <button
              type="button"
              className="equipment-group-toggle"
              onClick={() => toggleGroup(group.id)}
              disabled={disabled}
            >
              <span className="equipment-group-label">
                {group.label}
                {groupSelectedIds.size > 0 && (
                  <span className="equipment-group-count">
                    ({groupSelectedIds.size})
                  </span>
                )}
              </span>
              <span
                className={`equipment-group-icon${isExpanded ? " expanded" : ""}`}
              >
                ▸
              </span>
            </button>

            {isExpanded && (
              <div className="equipment-group-items">
                {group.items.map((item) => {
                  const isChecked = groupSelectedIds.has(item.id);
                  const checkboxId = `eq-${group.id}-${item.id}`;

                  return (
                    <label
                      key={item.id}
                      className="equipment-item"
                      htmlFor={checkboxId}
                    >
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleItemToggle(group.id, item.id)}
                        disabled={disabled}
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {selectedCount > 0 && (
        <div className="equipment-filter-info">
          Within each category uses OR logic. Between categories uses AND logic.
        </div>
      )}
    </div>
  );
}

export default EquipmentFilter;
