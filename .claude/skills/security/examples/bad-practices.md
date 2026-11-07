# ❌ Bad Security Practices — What NOT to Do

> Real-world examples of vulnerable code, with explanations.
> Used by security-skill for pattern detection.

---

## 🔴 Secrets & Configuration

```js
// NEVER: Hardcoded secrets in source code
const STRIPE_KEY = 'sk_live_abc123xyz456'
const DB_PASS = 'mypassword123'
const JWT_SECRET = 'secret'

// NEVER: Secrets in NEXT_PUBLIC_ env vars
const key = process.env.NEXT_PUBLIC_STRIPE_SECRET  // exposed in bundle!

// NEVER: .env committed to git
// Check: git log --all -- .env

// NEVER: console.log of environment variables
console.log('Starting with config:', process.env)
```

## 🔴 SQL Injection

```js
// NEVER: String concatenation in SQL
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`
db.query(`DELETE FROM posts WHERE id = ${req.params.id}`)

// NEVER: Template literals with user input in DB queries
await pool.query(`SELECT * FROM users WHERE name LIKE '%${search}%'`)
```

## 🔴 Authentication

```js
// NEVER: Weak hashing for passwords
const hash = md5(password)
const hash = sha256(password)

// NEVER: Same error for wrong email vs wrong password (reveals user existence)
if (!user) return res.json({ error: 'User not found' })
if (!valid) return res.json({ error: 'Wrong password' })

// NEVER: No rate limit on login
app.post('/login', loginHandler)  // unprotected

// NEVER: JWT with 'none' algorithm accepted
jwt.verify(token, secret)  // no algorithm restriction

// NEVER: Short JWT secret
const JWT_SECRET = 'secret123'
```

## 🔴 Dangerous Functions

```js
// NEVER: eval() with user input
eval(req.body.code)
new Function(req.body.expression)()

// NEVER: innerHTML with user input
element.innerHTML = userComment  // XSS

// NEVER: exec() with user input
exec(`ls ${req.query.dir}`)  // RCE

// NEVER: Dynamic require with user input
require(req.body.module)  // arbitrary module load
```

## 🔴 CORS

```js
// NEVER: Wildcard CORS in production
app.use(cors())  // defaults to *
app.use(cors({ origin: '*' }))

// NEVER: Trust Origin header blindly
app.use(cors({ origin: req.headers.origin }))  // any origin!
```

## 🔴 Database Rules

```javascript
// Firebase: NEVER
allow read, write: if true;  // world-readable/writable

// Supabase: NEVER skip RLS
// (tables without RLS = all authenticated users see all data)
```

## 🔴 File Upload

```js
// NEVER: Trust file extension from client
if (file.name.endsWith('.jpg')) accept()  // forged extension

// NEVER: Store uploaded files in web root
const path = `public/uploads/${file.name}`  // directly accessible!

// NEVER: Use original filename in path
const dest = `/uploads/${req.body.filename}`  // path traversal!
```

## 🔴 Cryptography

```js
// NEVER: Use Math.random() for security values
const token = Math.random().toString(36)  // predictable!
const otp = Math.floor(Math.random() * 1000000)  // predictable!

// NEVER: Disable TLS verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// NEVER: Static IV for encryption
const iv = Buffer.alloc(16, 0)  // same IV every time = broken
```

## 🔴 Sessions & Cookies

```js
// NEVER: Store auth token in localStorage
localStorage.setItem('token', jwt)  // accessible via XSS

// NEVER: Session cookie without security flags
res.cookie('session', id)  // no httpOnly, no secure, no sameSite

// NEVER: Skip session regeneration after login (session fixation)
req.session.userId = user.id  // without session.regenerate()!
```

## 🔴 Error Handling

```js
// NEVER: Expose stack traces to users
app.use((err, req, res, next) => {
  res.json({ error: err.message, stack: err.stack })  // reveals code!
})

// NEVER: Log sensitive data in errors
logger.error('Failed payment', { card: req.body.card, cvv: req.body.cvv })
```

## 🔴 SSRF

```js
// NEVER: Fetch arbitrary user-provided URLs
const data = await fetch(req.body.url)  // SSRF!
// Attack: http://169.254.169.254/latest/meta-data/ (AWS metadata)
```

## 🔴 Docker

```dockerfile
# NEVER: Run as root (default)
FROM node:20
# Missing: USER node

# NEVER: Secrets in Dockerfile
ENV DATABASE_URL=postgresql://root:password@localhost/mydb
RUN export API_KEY=sk_live_abc123 && npm run build

# NEVER: Pin to :latest
FROM node:latest
```

## 🔴 GitHub Actions

```yaml
# NEVER: Overly permissive
permissions: write-all

# NEVER: Tag-based actions (can be changed)
uses: actions/checkout@v4  # use SHA instead

# NEVER: pull_request_target + fork checkout (RCE)
on: pull_request_target
steps:
  - uses: actions/checkout@v4
    with:
      ref: ${{ github.event.pull_request.head.sha }}  # fork code!
  - run: npm test  # executes attacker's code with your secrets!
```
