import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const navigate = useNavigate();
  const [hackathonName, setHackathonName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  
  // Polling state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [pollingId, setPollingId] = useState(null);

  useEffect(() => {
    let interval;
    if (pollingId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/hackathon/progress/${pollingId}`);
          const json = await res.json();
          if (json.success && json.data) {
            setProgress(json.data);
            if (json.data.status === 'completed' || json.data.status === 'unknown or finished') {
              clearInterval(interval);
              navigate('/'); // Go back to dashboard when complete
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [pollingId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError("A CSV file of submissions is required.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('hackathon_name', hackathonName);
      if (description) formData.append('description', description);
      formData.append('csv_file', file);

      const res = await fetch('http://localhost:8000/api/hackathon/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (data.success) {
        setPollingId(data.data.hackathon_id);
      } else {
        setError(data.error || "Submission validation failed, check details.");
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "Failed to connect to server");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-12 mb-20 animate-fade-in">
      {loading && pollingId && progress && (
        <div className="fixed inset-0 bg-orchestra-dark/95 z-50 flex flex-col items-center justify-center p-4">
          <div className="mb-8 text-orchestra-green">
            <svg className="animate-spin h-16 w-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div className="flex flex-col space-y-4 max-w-lg w-full text-center font-mono">
             <h2 className="text-3xl font-bold text-white mb-2">Evaluating Batch...</h2>
             <div className="text-xl text-orchestra-green font-bold">
               {progress.completed} / {progress.total} Submissions Evaluated
             </div>
             
             {/* Progress Bar Loader */}
             <div className="w-full bg-gray-800 rounded-full h-4 mt-6">
                <div className="bg-orchestra-green h-4 rounded-full transition-all duration-500" style={{ width: `${(progress.completed / progress.total) * 100 || 5}%` }}></div>
             </div>

             {progress.errors && progress.errors.length > 0 && (
               <div className="mt-8 text-left text-sm text-red-400 max-h-40 overflow-y-auto p-4 bg-red-950/20 border border-red-900 rounded break-all">
                 <p className="font-bold border-b border-red-900 pb-2 mb-2">Skipped/Failed Projects:</p>
                 {progress.errors.map((e, idx) => <div key={idx} className="mb-2">- {e}</div>)}
               </div>
             )}
          </div>
        </div>
      )}

      {!pollingId && (
        <div className="bg-orchestra-dark rounded-2xl overflow-hidden shadow-2xl shadow-orchestra-green/10 border border-gray-800 transition-all hover:border-gray-700">
          <div className="h-2 bg-gradient-to-r from-orchestra-green to-lime-500 w-full"></div>
          <div className="p-8">
            <h2 className="text-3xl font-bold text-white mb-2">New Hackathon</h2>
            <p className="text-gray-400 mb-8">Upload a Devpost export or CSV to deploy the AI panel.</p>
            
            {error && <div className="p-4 bg-red-900/30 text-red-300 border border-red-800/50 rounded-lg mb-6 text-sm">{error}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Hackathon Event Name *</label>
                <input 
                  required 
                  type="text" 
                  value={hackathonName}
                  onChange={e => setHackathonName(e.target.value)}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orchestra-green focus:ring-1 focus:ring-orchestra-green transition-all" 
                  placeholder="e.g. Global AI Hackathon 2026" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Description (Optional)</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orchestra-green focus:ring-1 focus:ring-orchestra-green transition-all resize-none h-24" 
                  placeholder="Context for the AI panel..." 
                />
              </div>
              
              <div className="pt-4 border-t border-gray-800">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Submissions CSV *</label>
                <p className="text-xs text-gray-500 mb-3">Expected columns: <span className="text-gray-400 font-mono bg-black px-1 rounded">Team Name</span>, <span className="text-gray-400 font-mono bg-black px-1 rounded">GitHub URL</span>, <span className="text-gray-400 font-mono bg-black px-1 rounded">Pitch Deck URL</span></p>
                <input 
                  required
                  type="file" 
                  accept=".csv"
                  onChange={e => setFile(e.target.files[0])}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orchestra-green file:text-black hover:file:bg-lime-400 cursor-pointer focus:outline-none focus:border-orchestra-green transition-all" 
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-8 bg-orchestra-green hover:bg-lime-400 text-black font-bold text-lg py-4 px-4 rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-orchestra-green/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? 'Starting Batch...' : 'Start Autonomous Batch Evaluation'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
