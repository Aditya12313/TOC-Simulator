import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CFGSimulator from './pages/CFGSimulator';
import PDASimulator from './pages/PDASimulator';
import TMSimulator from './pages/TMSimulator';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="cfg" element={<CFGSimulator />} />
          <Route path="pda" element={<PDASimulator />} />
          <Route path="tm" element={<TMSimulator />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
