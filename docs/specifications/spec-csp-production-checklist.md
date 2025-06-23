# CSP Production Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Code Review and Configuration
- [ ] Review `lib/security/csp.ts` implementation
- [ ] Review `config/csp-production.config.ts` for production domains
- [ ] Verify `middleware.ts` applies CSP headers correctly
- [ ] Check `app/api/csp-report/route.ts` for violation reporting
- [ ] Ensure no localhost/development URLs in production config

### 2. Local Production Build Test
```bash
# Clean build
rm -rf .next

# Build with production settings
NODE_ENV=production npm run build

# Start production server locally
NODE_ENV=production npm start

# Test CSP headers
npm run test-csp-local
```

### 3. Verify CSP Headers Locally
```bash
# Test with curl
curl -I http://localhost:3000 | grep -i "content-security-policy"

# Run verification script
npm run verify-csp local
```

## 🚀 Deployment Process

### Stage 1: Deploy to Staging

1. **Push to staging branch**
```bash
git checkout staging
git merge main
git push origin staging
```

2. **Verify deployment**
```bash
# Wait for deployment to complete
# Then run verification
npm run verify-csp staging
```

3. **Manual testing checklist**
- [ ] Homepage loads correctly
- [ ] Login/authentication works
- [ ] Dashboard displays properly
- [ ] Trading charts load
- [ ] WebSocket connections establish
- [ ] External APIs respond
- [ ] No console CSP violations

### Stage 2: Production Deployment

1. **Final checks**
```bash
# Ensure all tests pass
npm test
npm run test:integration

# Verify CSP configuration
npm run verify-csp-config
```

2. **Deploy to production**
```bash
# Via Vercel CLI
vercel --prod

# Or via Git
git checkout main
git push origin main
```

3. **Post-deployment verification**
```bash
# Run production verification
npm run verify-csp production

# Generate verification report
npm run verify-csp production --report
```

## 🔍 Post-Deployment Monitoring

### Immediate Actions (First 30 minutes)
1. **Monitor CSP violations**
   - Check browser console on production site
   - Monitor `/api/csp-report` endpoint logs
   - Watch Sentry for CSP-related errors

2. **Test critical paths**
   - [ ] User registration/login
   - [ ] Trading interface
   - [ ] WebSocket data streams
   - [ ] Payment processing (if applicable)
   - [ ] API integrations

3. **Performance checks**
   - [ ] Page load times normal
   - [ ] No increase in error rates
   - [ ] API response times stable

### Ongoing Monitoring (First 24 hours)
1. **Check metrics**
   ```bash
   # View recent CSP violations (development only)
   curl -H "x-admin-token: ${ADMIN_TOKEN}" https://your-app.com/api/csp-report
   ```

2. **User feedback**
   - Monitor support channels
   - Check for user-reported issues
   - Review error tracking systems

## 🚨 Emergency Rollback Procedure

If critical issues occur:

### Option 1: Quick Disable (Recommended)
1. **Disable CSP in middleware**
```typescript
// In middleware.ts, comment out line ~104
// response = applyCSPHeaders(response, nonce, isDevelopment);
```

2. **Deploy hotfix**
```bash
git add middleware.ts
git commit -m "hotfix: Temporarily disable CSP headers"
git push origin main
```

### Option 2: Full Rollback
```bash
# Revert to previous deployment
vercel rollback

# Or via Git
git revert HEAD
git push origin main
```

## 📋 Configuration Reference

### Production Allowed Domains
- **Scripts**: Sentry, Google Analytics, Vercel
- **Styles**: Google Fonts, self
- **Connect**: Binance API/WebSocket, Supabase, Analytics
- **Images**: Vercel CDN, crypto logos
- **Fonts**: Google Fonts

### Security Headers Applied
- `Content-Security-Policy` (with nonce)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` (production only)

## 📊 Success Criteria

Deployment is successful when:
- [ ] All verification scripts pass
- [ ] No CSP violations in console
- [ ] All features work as expected
- [ ] Performance metrics stable
- [ ] No increase in error rates
- [ ] Security headers properly applied

## 🛠️ Useful Commands

```bash
# Verify CSP configuration
npm run verify-csp production

# Test CSP headers
npm run test-csp

# Check for CSP violations (dev)
npm run check-csp-violations

# Generate CSP report
npm run verify-csp production --report

# Monitor real-time (if configured)
npm run monitor-csp
```

## 📞 Escalation Contacts

- **Security Team**: security@company.com
- **DevOps Lead**: devops@company.com
- **On-Call**: Check PagerDuty
- **CTO**: For critical decisions

---

**Last Updated**: ${new Date().toISOString()}
**Version**: 1.0.0