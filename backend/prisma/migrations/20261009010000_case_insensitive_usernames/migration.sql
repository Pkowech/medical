DO $$
DECLARE
  collisions TEXT;
BEGIN
  SELECT string_agg(
    format('%s (%s accounts)', normalized_username, account_count),
    ', '
  )
  INTO collisions
  FROM (
    SELECT lower(username) AS normalized_username, count(*) AS account_count
    FROM users
    WHERE username IS NOT NULL
    GROUP BY lower(username)
    HAVING count(*) > 1
  ) AS duplicate_usernames;

  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enforce case-insensitive usernames. Resolve these existing conflicts first: %',
      collisions;
  END IF;
END $$;

CREATE UNIQUE INDEX "users_username_lower_key"
ON "users" (LOWER("username"))
WHERE "username" IS NOT NULL;
