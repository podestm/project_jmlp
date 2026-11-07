# ✅ Good Security Practices — What TO Do

> Secure code patterns to follow in every project.
> Used by security-skill as fix templates.

---

## ✅ Secrets & Configuration

```js
// Always: Environment variables for secrets
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const dbUrl = process.env.DATABASE_URL

// Always: .env.example with placeholders
// STRIPE_SECRET_KEY=your_stripe_secret_key_here

// Always: .gitignore covers .env files

// Always: Generate strong secrets
// node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## ✅ Database Queries

```js
// Always: Parameterized queries
await pool.query('SELECT * FROM users WHERE email = $1', [email])
await prisma.user.findUnique({ where: { email } })

// Always: Input type coercion before NoSQL
const email = String(req.body.email).trim()
await User.findOne({ email })  // always a string now
```

## ✅ Authentication

```js
// Always: Strong password hashing
const hash = await bcrypt.hash(password, 12)
const hash = await argon2.hash(password)

// Always: Same error for wrong email AND wrong password
return res.status(401).json({ error: 'Invalid email or password' })

// Always: Rate limit auth endpoints
app.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), loginHandler)

// Always: Explicit JWT algorithm
jwt.verify(token, secret, { algorithms: ['HS256'] })

// Always: Strong JWT secret (256-bit random)
const JWT_SECRET = process.env.JWT_SECRET  // generated with crypto.randomBytes(32)
```

## ✅ Safe Code Patterns

```js
// Always: No eval — use structured data
const action = ALLOWED_ACTIONS[req.body.action]  // allowlist lookup

// Always: textContent instead of innerHTML
element.textContent = userComment  // XSS-safe

// Always: execFile with array (no shell)
execFile('convert', [inputPath, outputPath])

// Always: Crypto for random values
const token = crypto.randomBytes(32).toString('hex')
const otp = crypto.randomInt(100000, 999999)
```

## ✅ CORS

```js
// Always: Specific origin allowlist
app.use(cors({
  origin: ['https://app.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}))
```

## ✅ Database Rules

```javascript
// Firebase: Always require ownership
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

// Supabase: Always enable RLS + add policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data only" ON users
  FOR ALL USING (auth.uid() = id);
```

## ✅ File Upload

```js
// Always: Validate real MIME type from bytes
const type = await fileTypeFromBuffer(buffer)
if (!['image/jpeg', 'image/png'].includes(type?.mime)) {
  return res.status(400).json({ error: 'Invalid file type' })
}

// Always: Randomize filename + store outside web root
const storedName = crypto.randomBytes(16).toString('hex') + '.jpg'
const filePath = '/var/uploads/' + storedName  // not in public/

// Always: Strip image metadata
await sharp(buffer).jpeg({ quality: 85 }).toFile(outputPath)
```

## ✅ Cryptography

```js
// Always: crypto.randomBytes() for security values
const token = crypto.randomBytes(32).toString('hex')

// Always: Random IV per encryption
const iv = crypto.randomBytes(16)

// Always: Timing-safe comparison
const safe = timingSafeEqual(Buffer.from(a), Buffer.from(b))
```

## ✅ Sessions & Cookies

```js
// Always: HttpOnly cookie for tokens
res.cookie('token', jwt, { httpOnly: true, secure: true, sameSite: 'strict' })

// Always: Regenerate session after login (prevent fixation)
req.session.regenerate((err) => {
  req.session.userId = user.id
  res.redirect('/dashboard')
})

// Always: Destroy session on logout
req.session.destroy()
res.clearCookie('session')
res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"')
```

## ✅ Error Handling

```js
// Always: Generic user message + detailed server log
app.use((err, req, res, next) => {
  const errorId = crypto.randomUUID()
  logger.error({ errorId, err })  // full error in logs
  res.status(500).json({ error: 'Internal server error', errorId })
})
```

## ✅ Security Headers (Express)

```js
import helmet from 'helmet'
app.use(helmet({
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
}))
app.disable('x-powered-by')
```

## ✅ Docker

```dockerfile
# Always: Non-root user
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
EXPOSE 3000
CMD ["node", "server.js"]
```

## ✅ GitHub Actions

```yaml
# Always: Minimal permissions
permissions:
  contents: read

# Always: PIN to SHA
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

# Always: Env var for inputs (not inline in run:)
- name: Process
  env:
    USER_INPUT: ${{ github.event.pull_request.title }}
  run: echo "$USER_INPUT"
```

## ✅ Authorization

```js
// Always: Check ownership on every resource access
const resource = await Resource.findOne({
  _id: req.params.id,
  ownerId: req.user.id  // MUST match
})
if (!resource) return res.status(404)

// Always: Auth middleware on every protected route
app.get('/admin', requireAuth, requireAdmin, handler)
app.get('/api/invoices/:id', requireAuth, handler)
```

## ✅ Input Validation

```js
// Always: Whitelist over blacklist
const ALLOWED_ROLES = ['user', 'moderator', 'admin']
if (!ALLOWED_ROLES.includes(role)) return res.status(400)

// Always: Fail secure (deny on error, not allow)
try {
  await verifyToken(token)
} catch {
  return res.status(401).json({ error: 'Unauthorized' })  // deny
}

// Always: Schema validation for all inputs
const schema = z.object({ email: z.string().email(), age: z.number().min(0).max(150) })
const data = schema.parse(req.body)  // throws if invalid
```
