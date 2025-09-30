import { BrowserRouter, Routes, Route } from 'react-router-dom';

function TestRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div style={{padding: '20px', backgroundColor: 'lightblue'}}>
          <h1>Test Page</h1>
          <p>Pokud vidíte tuto stránku, React Router funguje správně!</p>
        </div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default TestRouter;