import { useState } from 'react';
import DaylightViz from './DaylightViz';
import Analyze from './Analyze';
import './index.css';

function App() {
  const [page, setPage] = useState('viz'); // 'viz' or 'analyze'

  return (
    <div className="flex flex-col items-center w-full min-h-screen p-4 md:p-8 font-sans">
      <nav className="flex justify-center w-full max-w-7xl mb-8">
        <div className="flex gap-2 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e] p-2 shadow-lg">
          <button
            onClick={() => setPage('viz')}
            className={`flex items-center gap-2 rounded-md px-3 py-2 sm:px-4 text-sm font-medium transition-colors ${
              page === 'viz'
                ? 'bg-yellow-500 text-gray-900 shadow-md'
                : 'text-gray-300 hover:bg-[#2a2a3e]'
            }`}
          >
            Visualizer
          </button>
          <button
            onClick={() => setPage('analyze')}
            className={`flex items-center gap-2 rounded-md px-3 py-2 sm:px-4 text-sm font-medium transition-colors ${
              page === 'analyze'
                ? 'bg-yellow-500 text-gray-900 shadow-md'
                : 'text-gray-300 hover:bg-[#2a2a3e]'
            }`}
          >
            Analyze
          </button>
        </div>
      </nav>

      <main className="w-full max-w-[1400px]">
        {page === 'viz' && <DaylightViz />}
        {page === 'analyze' && <Analyze />}
      </main>
    </div>
  );
}

export default App;