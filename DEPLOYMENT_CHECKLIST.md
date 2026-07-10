# Deployment Checklist & Production Verification

**Status:** ✅ UPDATED June 4, 2026  
**Purpose:** Pre/post-deployment verification steps  
**Last Review:** June 4, 2026  

## Pre-Deployment Verification

### Backend Verification

- [ ] **Database Check**
  - [ ] Verify `UserRole` junction table has correct entries
  - [ ] Test: `SELECT u.id, ARRAY_AGG(r.name) as roles FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id LEFT JOIN roles r ON ur.role_id = r.id GROUP BY u.id LIMIT 5;`
  - [ ] Confirm users have correct role assignments

- [ ] **Auth Service Methods**
  - [ ] Test `login()` returns `roles: Role[]`
  - [ ] Test `register()` returns `roles: Role[]`
  - [ ] Test `refreshToken()` maintains roles
  - [ ] Test `validateUser()` includes all roles

- [ ] **API Response Format**
  - [ ] Verify login response includes `user.roles`
  - [ ] Verify JWT payload includes `roles` array
  - [ ] Check error handling for missing roles

- [ ] **Multi-Role Users**
  - [ ] Create test user with 2 roles (e.g., student + instructor)
  - [ ] Verify login returns both roles
  - [ ] Confirm JWT contains all roles
  - [ ] Test token refresh maintains roles

### Frontend Verification

- [ ] **NextAuth Configuration**
  - [ ] JWT callback stores `token.roles`
  - [ ] Session callback includes `session.user.roles`
  - [ ] Authorize function captures `user.roles`

- [ ] **Type Safety**
  - [ ] User interface includes `roles?: string[]`
  - [ ] No TypeScript errors related to roles
  - [ ] usePermissions hook returns allRoles

- [ ] **Session Data**
  - [ ] `getSession()` returns user with roles array
  - [ ] Token refresh preserves roles
  - [ ] Pages have access to complete role list

- [ ] **Dashboard Components**
  - [ ] usePermissions returns `allRoles`
  - [ ] Dashboard filters by all roles
  - [ ] Multi-role users see all applicable tabs
  - [ ] Navigation includes all allowed items

### Role-Based Access Control

- [ ] **Single Role Users**
  - [ ] Student sees only student dashboard
  - [ ] Instructor sees only instructor dashboard
  - [ ] Admin sees admin dashboards
  - [ ] No unauthorized feature access

- [ ] **Multi-Role Users**
  - [ ] Student + Instructor sees both dashboards
  - [ ] Admin + Instructor sees both dashboards
  - [ ] All three dashboards work for 3-role user
  - [ ] Correct permissions for each role

- [ ] **guest Users**
  - [ ] Redirected to login
  - [ ] Can't access protected pages
  - [ ] Public pages still accessible

## Deployment Steps

### Step 1: Database Migration
```bash
# No migration needed if schema already supports UserRole
# Verify existing data:
psql $DATABASE_URL -c "SELECT COUNT(*) FROM user_roles;"
```

### Step 2: Backend Deployment
```bash
# 1. Build
npm run build

# 2. Run tests
npm run test
npm run test:e2e

# 3. Deploy to production
# (Use your standard deployment process)

# 4. Verify API response
curl -X POST http://backend/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password"}'

# 5. Check response includes roles:
# Should see: "roles": ["student"], or ["instructor", "admin"], etc.
```

### Step 3: Frontend Deployment
```bash
# 1. Build
npm run build

# 2. Run tests
npm run test

# 3. Deploy to production
# (Use your standard deployment process)

# 4. Verify session data
# Open DevTools > Application > Cookies
# Check next-auth.session-token contains roles

# 5. Test dashboard access
# Login as multi-role user
# Should see multiple dashboard tabs
```

### Step 4: Smoke Testing
```bash
# Test 1: Student Login
curl -X POST http://backend/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"pass"}' | jq '.data.user.roles'
# Expected: ["student"]

# Test 2: Admin Login  
curl -X POST http://backend/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin1","password":"pass"}' | jq '.data.user.roles'
# Expected: ["admin"] or ["instructor", "admin"]

# Test 3: Multi-role Login
curl -X POST http://backend/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user123","password":"pass"}' | jq '.data.user.roles'
# Expected: ["student", "instructor"] or similar

# Test 4: Frontend Dashboard
# Open http://frontend/dashboard in browser
# For multi-role user, verify all applicable tabs visible
```

## Rollback Plan

If issues occur:

### Option 1: Quick Rollback (< 5 minutes)
```bash
# 1. Revert frontend to previous version
git revert <commit-hash>
npm run build && npm run deploy

# 2. Check dashboard displays correctly
# Multi-role users should still work (will only show primary role)
```

### Option 2: Database Rollback
```bash
# Restore from backup if roles data corrupted
pg_restore --clean -d $DATABASE_URL backup.sql

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM user_roles;"
```

### Option 3: Partial Rollback
```bash
# Keep backend changes, revert frontend
# Users can still login, but frontend only uses primary role
# Equivalent to the "Before" implementation
```

## Post-Deployment Monitoring

### Metrics to Track

- [ ] **Login Success Rate**
  - [ ] Compare before/after
  - [ ] Should not decrease
  - [ ] Alert if < 99%

- [ ] **Token Refresh Rate**
  - [ ] Monitor refresh endpoint calls
  - [ ] Roles should persist through refresh
  - [ ] Alert on refresh failures

- [ ] **Dashboard Load Time**
  - [ ] Should not significantly increase
  - [ ] Multi-role dashboards may load slower
  - [ ] Alert if > 2s slower

- [ ] **Error Rates**
  - [ ] Monitor "unauthorized" errors
  - [ ] Watch for role-related errors
  - [ ] Check console for role-related warnings

### Logging to Monitor

```
// Backend logs to watch for
- "Login successful, user roles: [...]"
- "JWT created with roles: [...]"
- "Permission calculation for roles: [...]"

// Frontend logs to watch for
- "usePermissions: allRoles = [...]"
- "Dashboard filtering by roles: [...]"
- "Token refresh successful with roles: [...]"
```

## Known Issues & Solutions

### Issue 1: User missing roles after login
**Symptoms:** `user.roles` is undefined
**Check:**
- [ ] Backend returning roles in login response
- [ ] NextAuth JWT callback storing roles
- [ ] Session callback including roles
**Solution:**
```bash
# Verify backend response
curl http://backend/v1/auth/login | jq '.data.user.roles'

# Check NextAuth tokens
console.log(token) in jwt callback
console.log(session) in session callback
```

### Issue 2: Multi-role user sees wrong dashboards
**Symptoms:** User has 2 roles but only sees 1 dashboard
**Check:**
- [ ] usePermissions returning allRoles
- [ ] Dashboard filtering by allRoles not just role
- [ ] Database has correct UserRole entries
**Solution:**
```typescript
// Verify in browser console
const session = await getSession();
console.log('All roles:', session.user.roles);
console.log('Primary role:', session.user.role);
```

### Issue 3: Student can access admin features
**Symptoms:** Unauthorized access to admin content
**Check:**
- [ ] Components checking user.roles not user.role
- [ ] Backend API checking permissions
- [ ] withRole HOC properly configured
**Solution:**
```typescript
// Check component is using allRoles
if (user.roles?.includes('admin')) { // ✅ Correct
  // not if (user.role === 'admin') // ❌ Wrong
}
```

### Issue 4: Token refresh loses roles
**Symptoms:** Roles disappear after token refresh
**Check:**
- [ ] refreshToken method returns roles
- [ ] JWT callback preserves roles on refresh
- [ ] Session callback resets roles
**Solution:**
```typescript
// In jwt callback, preserve existing roles
const payload: JwtPayload = {
  ...token,  // Keep existing roles if present
  role: user.role,
  roles: user.roles || token.roles, // Preserve if not updated
};
```

## Verification Checklist (Post-Deployment)

### Week 1
- [ ] Monitor error rates - should remain stable
- [ ] Check user feedback - no reports of access issues
- [ ] Verify multi-role users can access all dashboards
- [ ] Confirm single-role users access only their dashboard
- [ ] No unauthorized access reported

### Week 2
- [ ] Performance metrics stable
- [ ] Token refresh working correctly
- [ ] Role information persisting across sessions
- [ ] Navigation filtering working for all roles
- [ ] Admin features only accessible to admins

### Week 4
- [ ] Full regression testing completed
- [ ] All user types tested (guest, student, instructor, admin, multi-role)
- [ ] Cross-browser testing passed
- [ ] Mobile access working correctly
- [ ] Performance baseline established

## Documentation Updates

After deployment, update:

- [ ] **User Guides**
  - [ ] Admin guide for assigning multiple roles
  - [ ] User guide for switching dashboards
  - [ ] Support documentation

- [ ] **Developer Docs**
  - [ ] Update API documentation
  - [ ] Add multi-role examples to codebase
  - [ ] Document role assignment process

- [ ] **Architecture Docs**
  - [ ] Update system architecture diagram
  - [ ] Document role hierarchy
  - [ ] Add flow diagrams

## Success Criteria

Implementation is successful when:

✅ All users can login and see appropriate dashboards based on their roles

✅ Single-role users see only their role's dashboard

✅ Multi-role users see all applicable dashboards

✅ Unauthorized features are not accessible to users without required roles

✅ Role information persists across page refreshes and token refreshes

✅ Admin features visible only to admin users

✅ Student content only accessible to students

✅ No errors in browser console related to roles

✅ No errors in server logs related to roles

✅ Performance metrics unchanged or improved

✅ All tests passing (unit, integration, e2e)

## Support & Troubleshooting

For issues during deployment:

1. **Check Backend Logs**
   ```bash
   tail -f /var/log/backend/error.log | grep -i role
   ```

2. **Check Frontend Console**
   - DevTools > Console
   - Search for "role" or "permission" errors

3. **Verify Database**
   ```sql
   SELECT u.id, u.email, ARRAY_AGG(r.name) as roles 
   FROM users u 
   LEFT JOIN user_roles ur ON u.id = ur.user_id 
   LEFT JOIN roles r ON ur.role_id = r.id 
   GROUP BY u.id, u.email 
   LIMIT 10;
   ```

4. **Test Token Content**
   - Use jwt.io to decode token
   - Verify roles array is present
   - Check expiration times

5. **Contact Deployment Team**
   - Include error messages
   - Provide affected user IDs
   - Share reproduction steps
