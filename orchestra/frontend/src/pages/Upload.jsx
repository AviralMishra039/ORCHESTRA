import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [prototypeUrl, setPrototypeUrl] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [allMessages, setAllMessages] = useState([]);
  const [timers, setTimers] = useState([]);

  const messages = [
    { time: 0, text: "Parsing submission..." },
    { time: 5000, text: "Consulting Innovation Judge..." },
    { time: 10000, text: "Consulting Technical Judge..." },
    { time: 15000, text: "Consulting Business Judge..." },
    { time: 20000, text: "Consulting Presentation Judge..." },
    { time: 25000, text: "Consulting Clarity Judge..." },
    { time: 30000, text: "Running Bias Auditor..." },
    { time: 35000, text: "Chief Judge deliberating..." },
    { time: 40000, text: "Generating feedback report..." }
  ];

  useEffect(() => {
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [timers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!file && (!githubUrl || githubUrl.trim() === '')) {
      setError("At least one of Pitch Deck or GitHub Repo URL must be provided.");
      return;
    }

    setLoading(true);
    setAllMessages([]);

    const newTimers = messages.map((m) => {
      return setTimeout(() => {
        setAllMessages(prev => [...prev, m.text]);
      }, m.time);
    });
    setTimers(newTimers);

    try {
      const formData = new FormData();
      formData.append('team_name', teamName);
      if (githubUrl) formData.append('github_url', githubUrl);
      if (prototypeUrl) formData.append('prototype_url', prototypeUrl);
      if (file) formData.append('pptx_file', file);

      const res = await fetch('http://localhost:8000/api/submit', {
        method: 'POST',
        body: formData
      });
      
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw new Error("Invalid backend response. Ensure server is running.");
      }
      
      newTimers.forEach(clearTimeout);

      if (data.success) {
        navigate(`/feedback/${data.data.submission_id}`);
      } else {
        if (typeof data.error === 'string') setError(data.error);
        else setError("Submission validation failed, check details.");
        setLoading(false);
      }
    } catch (err) {
      newTimers.forEach(clearTimeout);
      setError(err.message || "Failed to connect to server");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-12 mb-20 animate-fade-in">
      {loading && (
        <div className="fixed inset-0 bg-orchestra-dark/95 z-50 flex flex-col items-center justify-center p-4">
          <div className="mb-8 text-orchestra-green">
            <svg className="animate-spin h-12 w-12" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div className="flex flex-col space-y-4 max-w-lg w-full text-left font-mono">
            {allMessages.map((msg, i) => (
              <div key={i} className="text-orchestra-green animate-pulse text-lg">
                > {msg}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-orchestra-dark rounded-2xl overflow-hidden shadow-2xl shadow-orchestra-green/10 border border-gray-800 transition-all hover:border-gray-700">
        <div className="h-2 bg-gradient-to-r from-orchestra-green to-lime-500 w-full"></div>
        <div className="p-8">
          <h2 className="text-3xl font-bold text-white mb-2">New Submission</h2>
          <p className="text-gray-400 mb-8">Deploy the AI panel to evaluate a hackathon project.</p>
          
          {error && <div className="p-4 bg-red-900/30 text-red-300 border border-red-800/50 rounded-lg mb-6 text-sm">{error}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Team Name *</label>
              <input 
                required 
                type="text" 
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orchestra-green focus:ring-1 focus:ring-orchestra-green transition-all" 
                placeholder="e.g. Acme Hackers" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Pitch Deck (.pptx)</label>
              <input 
                type="file" 
                accept=".pptx"
                onChange={e => setFile(e.target.files[0])}
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orchestra-green file:text-black hover:file:bg-lime-400 cursor-pointer focus:outline-none focus:border-orchestra-green transition-all" 
              />
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex-1 h-px bg-gray-800"></div>
              <span className="text-gray-500 font-medium text-sm">AND / OR</span>
              <div className="flex-1 h-px bg-gray-800"></div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">GitHub Repo URL</label>
              <input 
                type="url" 
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orchestra-green focus:ring-1 focus:ring-orchestra-green transition-all" 
                placeholder="https://github.com/user/repo" 
              />
            </div>

            <div className="pt-4 mt-6 border-t border-gray-800">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Prototype Link (Optional)</label>
              <input 
                type="url" 
                value={prototypeUrl}
                onChange={e => setPrototypeUrl(e.target.value)}
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orchestra-green focus:ring-1 focus:ring-orchestra-green transition-all" 
                placeholder="https://vignette.acme.com" 
              />
            </div>

            <button 
              type="submit" 
              className="w-full mt-8 bg-orchestra-green hover:bg-lime-400 text-black font-bold text-lg py-4 px-4 rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-orchestra-green/20"
            >
              Start Autonomous Panel
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
