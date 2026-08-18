-- Allow TA_SITE to create and update candidate master data (delete remains blocked in routes).
UPDATE menu_access
SET "createRoles" = CASE
      WHEN 'TA_SITE' = ANY("createRoles") THEN "createRoles"
      ELSE array_append("createRoles", 'TA_SITE')
    END,
    "editRoles" = CASE
      WHEN 'TA_SITE' = ANY("editRoles") THEN "editRoles"
      ELSE array_append("editRoles", 'TA_SITE')
    END,
    "updatedAt" = NOW()
WHERE "menuPath" = '/candidates';
