import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, BarChart3, Users, CheckCircle, TrendingUp, Shield, Menu, X } from 'lucide-react';
import AppDownload from '../components/AppDownload';

// ✅ IMPORT LOGO
import logo from '../assets/Logo.png';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-900/95 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Navbar Logo */}
            <div className="flex items-center space-x-3">
              <img 
                src={logo} 
                alt="TaskRoute Logo" 
                className="w-10 h-10 rounded-full bg-white p-1 object-contain shadow-md" 
              />
              <span className="text-xl font-bold">TaskRoute Tracker</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollToSection('about')} className="hover:text-blue-400 transition">About</button>
              <button onClick={() => scrollToSection('features')} className="hover:text-blue-400 transition">Features</button>
              <button onClick={() => scrollToSection('how-it-works')} className="hover:text-blue-400 transition">How It Works</button>
              <button onClick={() => scrollToSection('download')} className="hover:text-blue-400 transition">Download App</button>
              <Link to="/login" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition duration-200">
                Login
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 space-y-4 bg-slate-900/95 rounded-b-2xl border-t border-gray-800">
              <button onClick={() => scrollToSection('about')} className="block w-full text-left px-4 hover:text-blue-400 transition">About</button>
              <button onClick={() => scrollToSection('features')} className="block w-full text-left px-4 hover:text-blue-400 transition">Features</button>
              <button onClick={() => scrollToSection('how-it-works')} className="block w-full text-left px-4 hover:text-blue-400 transition">How It Works</button>
              <button onClick={() => scrollToSection('download')} className="block w-full text-left px-4 hover:text-blue-400 transition">Download App</button>
              <div className="px-4 pt-2">
                <Link to="/login" className="block w-full bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold text-center transition duration-200">
                    Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          
          {/* ✅ HERO LOGO */}
          <div className="flex justify-center mb-8">
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-[2rem] blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                <img 
                    src={logo} 
                    alt="TaskRoute Tracker Logo" 
                    className="relative h-32 w-32 md:h-40 md:w-40 bg-white p-2 rounded-[2rem] shadow-2xl object-contain transform transition duration-500 hover:scale-105"
                />
            </div>
          </div>

          <div className="mb-8 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              TaskRoute Tracker
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-4">
              GPS-Enabled Task Management with ML-Powered Performance Analytics
            </p>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto">
              Monitor field operations in real-time. Predict task completion. Optimize resource allocation with intelligent forecasting.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              to="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition duration-200"
            >
              Login to Dashboard
            </Link>
            <button
              onClick={() => scrollToSection('download')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition duration-200 border border-slate-600"
            >
              Get Mobile App
            </button>
          </div>

          {/* Hero Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 transform hover:scale-105 transition duration-200 border border-white/10">
              <MapPin className="w-12 h-12 text-blue-400 mx-auto mb-3" />
              <h3 className="text-3xl font-bold mb-2">Real-Time</h3>
              <p className="text-gray-300">GPS Tracking</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 transform hover:scale-105 transition duration-200 border border-white/10">
              <TrendingUp className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
              <h3 className="text-3xl font-bold mb-2">AI-Powered</h3>
              <p className="text-gray-300">Forecasting</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 transform hover:scale-105 transition duration-200 border border-white/10">
              <Users className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <h3 className="text-3xl font-bold mb-2">Multi-Role</h3>
              <p className="text-gray-300">Access Control</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-20 bg-slate-800/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">About TaskRoute Tracker</h2>
            <div className="w-24 h-1 bg-blue-400 mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">Our Mission</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                TaskRoute Tracker is designed to address the critical gaps in field-based task management for small and medium-sized enterprises. We combine real-time GPS monitoring with predictive analytics to transform how organizations coordinate field operations.
              </p>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">The Problem We Solve</h3>
              <p className="text-gray-300 leading-relaxed">
                Many organizations still rely on manual or fragmented tracking systems, resulting in inefficiencies, lack of accountability, and limited forecasting capabilities. TaskRoute Tracker provides a unified platform that enables data-driven decision-making and transparent task monitoring.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 p-6 rounded-lg border border-blue-400/30">
                <h4 className="font-semibold text-lg mb-2 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                  Real-Time Visibility
                </h4>
                <p className="text-gray-300 text-sm">Monitor field personnel location and task progress instantly</p>
              </div>

              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6 rounded-lg border border-purple-400/30">
                <h4 className="font-semibold text-lg mb-2 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                  Predictive Analytics
                </h4>
                <p className="text-gray-300 text-sm">Forecast task durations and potential delays using Prophet + XGBoost models</p>
              </div>

              <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 p-6 rounded-lg border border-cyan-400/30">
                <h4 className="font-semibold text-lg mb-2 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                  Enhanced Accountability
                </h4>
                <p className="text-gray-300 text-sm">Time-stamped logs and location verification for every task</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Powerful Features</h2>
            <p className="text-gray-400 text-lg">Everything you need to manage field operations effectively</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: <MapPin className="w-8 h-8" />,
                title: "GPS Location Tracking",
                description: "Real-time monitoring of field personnel with route history and location verification",
                color: "from-blue-500 to-cyan-500"
              },
              {
                icon: <Clock className="w-8 h-8" />,
                title: "Time Logging",
                description: "Automated time tracking with start/end timestamps and task duration analysis",
                color: "from-purple-500 to-pink-500"
              },
              {
                icon: <BarChart3 className="w-8 h-8" />,
                title: "Performance Analytics",
                description: "Comprehensive dashboards with KPIs, completion rates, and efficiency metrics",
                color: "from-green-500 to-emerald-500"
              },
              {
                icon: <TrendingUp className="w-8 h-8" />,
                title: "Task Forecasting",
                description: "ML-powered predictions for task completion times and potential delays",
                color: "from-orange-500 to-red-500"
              },
              {
                icon: <Users className="w-8 h-8" />,
                title: "Role-Based Access",
                description: "Separate interfaces for owners, supervisors, and field personnel",
                color: "from-indigo-500 to-purple-500"
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: "Privacy & Security",
                description: "Encrypted data transmission with task-scoped tracking and audit logs",
                color: "from-cyan-500 to-blue-500"
              }
            ].map((feature, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-md rounded-xl p-6 hover:bg-white/15 transition duration-300 transform hover:-translate-y-2 border border-white/5">
                <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 shadow-lg`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-300 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-slate-800/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 text-lg">Simple workflow for effective task management</p>
          </div>

          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Task Assignment",
                description: "Owners and supervisors create and assign tasks to field personnel through the web dashboard. Tasks include details, deadlines, and location information.",
                icon: <Users className="w-8 h-8" />
              },
              {
                step: "02",
                title: "Real-Time Tracking",
                description: "Field personnel receive tasks on their mobile app. GPS automatically logs their location and route as they complete assignments.",
                icon: <MapPin className="w-8 h-8" />
              },
              {
                step: "03",
                title: "Progress Monitoring",
                description: "Supervisors monitor task progress in real-time through the dashboard, viewing employee locations, time spent, and task status updates.",
                icon: <BarChart3 className="w-8 h-8" />
              },
              {
                step: "04",
                title: "AI-Powered Forecasting",
                description: "System analyzes historical data to predict task completion times and identify potential delays, enabling proactive resource management.",
                icon: <TrendingUp className="w-8 h-8" />
              }
            ].map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-6 items-start group">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">
                    {item.step}
                  </div>
                </div>
                <div className="flex-grow bg-white/5 p-6 rounded-xl hover:bg-white/10 transition duration-300 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-blue-400">{item.icon}</div>
                    <h3 className="text-2xl font-bold">{item.title}</h3>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{item.description}</p>
                </div>
              </div>
              
            ))}
          </div>
        </div>
      </section>

      {/* ✅ NEW APP DOWNLOAD SECTION */}
      <section id="download" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
           <div className="text-center mb-12">
             <h2 className="text-3xl md:text-4xl font-bold mb-4">Download Mobile App</h2>
             <p className="text-gray-400">Field personnel can scan below to install the app directly.</p>
           </div>
           {/* Embed the Component */}
           <AppDownload />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Transform Your Field Operations?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Join organizations that are already improving efficiency and accountability with TaskRoute Tracker
          </p>
          <Link
            to="/login"
            className="inline-block bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-12 py-4 rounded-lg font-semibold text-lg shadow-2xl transform hover:-translate-y-1 transition duration-200"
          >
            Login to Dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900/80 border-t border-slate-700 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                {/* Footer Logo */}
                <img src={logo} alt="Logo" className="w-8 h-8 rounded-full bg-white p-1 object-contain" />
                <span className="text-lg font-bold">TaskRoute Tracker</span>
              </div>
              <p className="text-gray-400 text-sm">
                GPS-enabled task management with ML-powered analytics for field operations.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-blue-400 transition">Features</button></li>
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-blue-400 transition">How It Works</button></li>
                <li><button onClick={() => scrollToSection('download')} className="hover:text-blue-400 transition">Download App</button></li>
                <li><Link to="/login" className="hover:text-blue-400 transition">Login</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><button onClick={() => scrollToSection('about')} className="hover:text-blue-400 transition">About Us</button></li>
                <li><a href="#" className="hover:text-blue-400 transition">Research Paper</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Developed By</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>Maghinang, Kirt Lei D.</li>
                <li>De Lara, Lloyd Joshua A.</li>
                <li>Gamay, Edjohn Christian Ds.</li>
                <li>Lucas, Aira Kelly R.</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2025 TaskRoute Tracker. A Capstone Project by Richwell Colleges, Incorporated.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;