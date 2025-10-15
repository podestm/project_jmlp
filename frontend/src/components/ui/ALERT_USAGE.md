# Alert Component - Dokumentace

## Přehled

Universal Alert komponenta s automatickým zmizením po 3 sekundách pro informační/success zprávy. Chybové zprávy zůstávají zobrazené, dokud je uživatel ručně nezavře.

## Import

```jsx
import Alert from '../ui/Alert.jsx';
```

## Použití

### Základní použití

```jsx
// Success alert (auto-dismiss po 3s)
<Alert 
  type="success" 
  message="Operace byla úspěšná!"
  onDismiss={() => setSuccess(null)}
/>

// Error alert (zůstane dokud ho uživatel nezavře)
<Alert 
  type="danger" 
  message="Nastala chyba při načítání dat."
  onDismiss={() => setError(null)}
/>

// Info alert (auto-dismiss po 3s)
<Alert 
  type="info" 
  message="Zpracovávám požadavek..."
  onDismiss={() => setInfo(null)}
/>

// Warning alert (auto-dismiss po 3s)
<Alert 
  type="warning" 
  message="Tato akce je nevratná!"
  onDismiss={() => setWarning(null)}
/>
```

### Pokročilé použití

#### Se složitějším obsahem (ikony, formátování)

```jsx
<Alert 
  type="success" 
  message={
    <>
      <i className="bi bi-check-circle-fill me-2"></i>
      Soubor "{filename}" byl úspěšně nahrán
    </>
  }
  onDismiss={() => setSuccess('')}
/>
```

#### Vlastní timeout

```jsx
// Disable auto-dismiss (i když je to success)
<Alert 
  type="success" 
  message="Tato zpráva se nezavře automaticky"
  autoDismissDelay={0}
/>

// Vlastní timeout 5 sekund
<Alert 
  type="info" 
  message="Zpráva zmizí za 5 sekund"
  autoDismissDelay={5000}
/>
```

## Props

| Prop | Typ | Default | Popis |
|------|-----|---------|-------|
| `type` | string | `'info'` | Typ alertu: `'success'`, `'danger'`, `'warning'`, `'info'` |
| `message` | string\|ReactNode | - | Zobrazený text nebo React komponenta |
| `onDismiss` | function | - | Callback při zavření alertu (click nebo auto-dismiss) |
| `autoDismissDelay` | number\|null | `null` | Vlastní timeout v ms. Pokud `null`, použije se default: `0` pro `danger`, `3000` pro ostatní |

## Automatické chování

### Auto-dismiss po 3 sekundách:
- ✅ `type="success"` 
- ✅ `type="info"`
- ✅ `type="warning"`

### Zůstává dokud ho uživatel nezavře:
- ❌ `type="danger"` (chybové zprávy)

## Příklady migrace

### Stará verze (Bootstrap alert)

```jsx
{error && (
  <div className="alert alert-danger alert-dismissible">
    {error}
    <button 
      type="button" 
      className="btn-close" 
      onClick={() => setError(null)}
    />
  </div>
)}
```

### Nová verze (Alert komponenta)

```jsx
{error && (
  <Alert 
    type="danger" 
    message={error}
    onDismiss={() => setError(null)}
  />
)}
```

## Implementované v komponentách

Následující admin komponenty již používají novou Alert komponentu:

- ✅ `AdminDashboard.jsx`
- ✅ `AdminLogin.jsx`
- ✅ `AdminRegister.jsx`
- ✅ `DocumentManagement.jsx`
- ✅ `CategoryManagement.jsx`
- ✅ `RaceRegistrations.jsx`
- ✅ `PostManagement.jsx`
- ✅ `RacerManagement.jsx`
- ✅ `race/RaceFilters.jsx`
- ✅ `post/PostFilters.jsx`

## Technické detaily

### Fade animace
- Komponenta používá Bootstrap `.fade` a `.show` třídy
- Vlastní CSS transition pro plynulé zmizení
- `setTimeout(onDismiss, 300)` počká na dokončení animace

### Cleanup
- `useEffect` vrací cleanup funkci pro `clearTimeout`
- Zabrání memory leaks při unmount komponenty

### State management
- Interní `visible` state pro kontrolu animace
- External `onDismiss` callback pro aktualizaci parent state

## Best Practices

1. **Vždy poskytnout `onDismiss` callback** - umožňuje uživateli zavřít alert ručně
2. **Pro error zprávy použít `type="danger"`** - nezavřou se automaticky
3. **Pro success/info použít default timeout** - uživatelé nemusí klikat na zavření
4. **Pro loading states použít `autoDismissDelay={0}`** - zůstanou dokud operace neskončí
5. **Komplexní obsah zabalit do `<>...</>`** - podporuje JSX v message prop

## Známá omezení

- Alert se nezobrazí, pokud `message` je `null`, `undefined`, nebo prázdný string
- Bootstrap 5 required pro styling (`.alert`, `.alert-*`, `.btn-close`)
- Bootstrap Icons required pro ikony (`.bi`, `.bi-*`)
