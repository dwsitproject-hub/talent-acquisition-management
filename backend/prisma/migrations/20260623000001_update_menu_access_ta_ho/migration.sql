-- Update menu_access rows: replace 'TA_TEAM' with 'TA_HO' in all role arrays
UPDATE menu_access
SET
  "visibleRoles" = array_replace("visibleRoles", 'TA_TEAM', 'TA_HO'),
  "createRoles"  = array_replace("createRoles",  'TA_TEAM', 'TA_HO'),
  "editRoles"    = array_replace("editRoles",     'TA_TEAM', 'TA_HO'),
  "updatedAt"    = NOW()
WHERE
  'TA_TEAM' = ANY("visibleRoles")
  OR 'TA_TEAM' = ANY("createRoles")
  OR 'TA_TEAM' = ANY("editRoles");
