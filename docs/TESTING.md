# 🧪 Testing Guide: Secure Token Storage

This guide helps you test the secure token storage functionality across different scenarios and platforms.

## 🚀 Quick Test

**Run the automated test suite:**
```bash
node test-security.js
```

This runs comprehensive tests of all security features and provides a detailed report.

## 🔍 Manual Testing Steps

### 1. **Test Keychain Availability**

```bash
# Check if keychain is working on your system
tempo-booker --test-keychain
```

**Expected Results:**
- ✅ **macOS**: Should work with **native macOS keychain** (preferred) or keytar fallback
- ✅ **Windows**: Should work with Credential Manager  
- ✅ **Linux**: Should work with libsecret/KWallet
- ⚠️ **If fails**: Falls back to environment variables

**macOS Enhanced Security:**
```
✅ macOS native keychain available
✅ Token updated in macOS keychain
✅ Token removed from macOS keychain
✅ macOS keychain test successful
```

### 2. **Test Fresh Setup (Clean Installation)**

```bash
# Remove any existing config
rm -f config.yaml .env

# Run fresh setup
tempo-booker --setup
```

**Test Steps:**
1. Enter your JIRA URL
2. Enter your Tempo API token
3. Complete setup

**Expected Results:**
- Token should be stored in keychain (not visible in config.yaml)
- Setup should complete successfully
- `config.yaml` should NOT contain your actual token

### 3. **Test Security Status**

```bash
# Check current security status
tempo-booker --security-status
```

**Expected Output:**
```
🔒 Token Security Status
📊 Storage Methods:
✅ macOS Native Keychain (most secure)    # On macOS systems
○ Environment Variables
✅ Config File (insecure)

🔍 Current Status:
✅ Token stored securely in macOS native keychain
```

**macOS Priority System:**
- **1st Priority**: macOS Native Keychain (using `security` command)
- **2nd Priority**: Cross-platform Keychain (keytar)
- **3rd Priority**: Environment Variables
- **4th Priority**: Interactive Prompt

### 4. **Test Token Retrieval**

```bash
# Test that the app can access your stored token
tempo-booker --help
```

**Expected Results:**
- App should start without prompting for token
- Should access keychain automatically
- No errors about missing tokens

### 5. **Test Migration from Insecure Storage**

**Setup Test:**
```bash
# Create config with token in it (simulating old version)
echo 'api:
  tempoToken: "test-token-12345"
  jiraBaseUrl: "https://test.atlassian.net"' > config.yaml
```

**Test Migration:**
```bash
tempo-booker --migrate-token
```

**Expected Results:**
- Should detect token in config
- Should offer to migrate to keychain
- Should provide instructions to remove from config

### 6. **Test Environment Variable Fallback**

```bash
# Remove keychain token (if exists)
tempo-booker --delete-token

# Set environment variable
export TEMPO_API_TOKEN="env-test-token"

# Test app
tempo-booker --security-status
```

**Expected Results:**
- Should show "Token in environment variables (moderately secure)"
- App should work with environment token

### 7. **Test Cross-Platform Keychain Access**

#### **macOS Testing:**
```bash
# After storing token, check Keychain Access app
open "/Applications/Utilities/Keychain Access.app"
# Search for "tempo-booker" service
```

#### **Windows Testing:**
```bash
# Check Windows Credential Manager
# Control Panel > Credential Manager > Generic Credentials
# Look for "tempo-booker" entry
```

#### **Linux Testing:**
```bash
# GNOME: Check with seahorse
seahorse

# KDE: Check with KWallet
kwalletmanager5
```

### 8. **Test Security Scenarios**

#### **Scenario A: No Token Stored**
```bash
tempo-booker --delete-token
unset TEMPO_API_TOKEN
rm config.yaml

tempo-booker
```
**Expected**: Should prompt for token interactively

#### **Scenario B: Multiple Storage Methods**
```bash
# Store in keychain AND set environment variable
tempo-booker --setup  # stores in keychain
export TEMPO_API_TOKEN="different-token"

tempo-booker --security-status
```
**Expected**: Should prefer keychain over environment

#### **Scenario C: Corrupted Keychain**
```bash
# This simulates keychain issues
tempo-booker --delete-token
# Manually break keychain access if possible
```
**Expected**: Should fall back gracefully to other methods

## 🔍 Verification Checklist

After testing, verify these security aspects:

### ✅ **Token Storage Security**
- [ ] Token NOT visible in `config.yaml`
- [ ] Token NOT visible in `.env` file
- [ ] Token stored in OS keychain (check with native tools)
- [ ] Token encrypted by operating system

### ✅ **Access Control**
- [ ] App can retrieve token automatically
- [ ] Token requires user authentication to access (OS-level)
- [ ] Token not accessible to other applications

### ✅ **Fallback Behavior**
- [ ] Environment variables work when keychain unavailable
- [ ] Interactive prompt works when no stored token
- [ ] Migration works from legacy config files

### ✅ **Cross-Platform Compatibility**
- [ ] Works on your operating system
- [ ] Uses native keychain/credential manager
- [ ] Graceful degradation on unsupported systems

## 🐛 Troubleshooting Tests

### **Issue: Keychain Test Fails**
```bash
npm install keytar
node -e "console.log(require('keytar'))"
```

### **Issue: Permission Denied**
```bash
# Check file permissions
ls -la config.yaml
chmod 600 config.yaml  # Restrict access
```

### **Issue: Token Not Found**
```bash
# Debug token retrieval
node -e "
const SecureTokenManager = require('./src/utils/secureTokenManager');
const tm = new SecureTokenManager();
tm.getToken().then(r => console.log('Token method:', r.method));
"
```

## 🔬 Advanced Testing

### **Load Testing Token Storage**
```bash
# Test multiple rapid token operations
for i in {1..10}; do
  echo "Test $i"
  tempo-booker --test-keychain
done
```

### **Security Audit**
```bash
# Check for token leakage in logs
grep -r "tempo.*token" logs/ || echo "No tokens found in logs ✅"

# Check process environment
ps aux | grep tempo-booker
```

### **Memory Testing**
```bash
# Check if token appears in memory dumps
# (Advanced - requires system tools)
pgrep tempo-booker | xargs -I {} cat /proc/{}/environ
```

## 📊 Expected Test Results Summary

| Test | macOS | Windows | Linux | Fallback |
|------|-------|---------|-------|----------|
| Keychain Storage | ✅ **Native + Keytar** | ✅ CredMan | ✅ libsecret | ✅ Env Vars |
| Token Encryption | ✅ **Enhanced Native** | ✅ Native | ✅ Native | ⚠️ None |
| Cross-App Security | ✅ **Maximum** | ✅ Yes | ✅ Yes | ❌ No |
| User Auth Required | ✅ **OS-Level** | ✅ Yes | ✅ Yes | ❌ No |
| Priority System | ✅ **4-Tier Fallback** | ✅ Standard | ✅ Standard | ✅ Standard |

## 🎯 Success Criteria

Your security system is working correctly if:

1. ✅ **Automated tests pass**: `node test-security.js` shows all green
2. ✅ **Token not in files**: No tokens visible in config.yaml or .env
3. ✅ **Keychain integration works**: Native OS tools show stored token
4. ✅ **App functions normally**: Can perform time tracking operations
5. ✅ **Security status clean**: `--security-status` shows secure storage
6. ✅ **Migration works**: Can move from insecure to secure storage

## 🚨 Security Validation

**Red Flags** (should NOT happen):
- ❌ Token visible in plain text files
- ❌ Token accessible to other users/processes
- ❌ Token stored without encryption
- ❌ App works after deleting token from all locations

If you see any red flags, the security system needs attention!

---

## 📞 Support

If tests fail or you encounter issues:

1. **Check Platform Support**: Ensure your OS supports keychain
2. **Review Dependencies**: Make sure `keytar` is installed properly
3. **Check Permissions**: Verify file and keychain access permissions
4. **Try Fallback**: Test with environment variables as backup
5. **Report Issues**: Document the test results and system info