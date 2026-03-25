import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-orchestra-dark border-b border-orchestra-green">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white tracking-widest uppercase flex items-center">
              <span className="mr-3 text-3xl">🎼</span> 
              Orchestra
            </span>
          </Link>
          <div className="flex space-x-6">
            <Link to="/submit" className="text-gray-300 hover:text-orchestra-green px-3 py-2 rounded-md font-medium transition-colors">
              Submit Project
            </Link>
            <Link to="/" className="text-gray-300 hover:text-orchestra-green px-3 py-2 rounded-md font-medium transition-colors">
              Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
