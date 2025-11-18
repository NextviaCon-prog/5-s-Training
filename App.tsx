
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateResearchForTopic, generateDetailForSubTopic, generateImageForResearch, generateAnswerForQuestion } from './services/geminiService';
import type { ResearchData, CachedTopic, SubTopic } from './types';
import LoadingSpinner from './components/LoadingSpinner';
import SectionCard from './components/SectionCard';

const topics: { key: keyof ResearchData; title: string; description: string }[] = [
  { key: 'origins', title: 'Origins of 5S', description: 'Discover the history and beginnings of the 5S methodology.' },
  { key: 'howItWorks', title: 'How It Works', description: 'An in-depth look at the 5 pillars of the system.' },
  { key: 'benefits', title: 'Benefits', description: 'Explore the tangible and intangible advantages of 5S.' },
  { key: 'keysToSuccess', title: 'Keys to Success', description: 'Critical factors for a successful implementation.' },
  { key: 'failureReasons', title: 'Why It Fails', description: 'Common pitfalls and reasons for implementation failure.' },
  { key: 'risks', title: 'Implementation Risks', description: 'Potential risks of a poorly managed 5S program.' },
];

const CACHE_KEY = '5s-research-cache';

// A small, self-contained component for rendering a single slide in the presentation view.
const PresentationSlide: React.FC<{ slide: { title: string; imageUrl: string | null } }> = ({ slide }) => (
    <div className="presentation-slide w-full max-w-4xl mx-auto bg-slate-800/50 border border-slate-700 rounded-2xl shadow-lg overflow-hidden mb-8">
        <h2 className="text-3xl font-bold text-cyan-400 p-6 border-b border-slate-700 text-center">
            {slide.title}
        </h2>
        <div className="p-6 flex items-center justify-center" style={{ minHeight: '60vh' }}>
            {slide.imageUrl ? (
                <img
                    src={slide.imageUrl}
                    alt={`Visual for ${slide.title}`}
                    className="w-full h-auto max-w-3xl rounded-lg object-contain"
                />
            ) : (
                <p className="text-slate-400">Visual not available.</p>
            )}
        </div>
    </div>
);


const App: React.FC = () => {
  const [view, setView] = useState<'menu' | 'detail' | 'present'>('menu');
  const [currentTopicKey, setCurrentTopicKey] = useState<keyof ResearchData | null>(null);
  const [currentSubTopic, setCurrentSubTopic] = useState<SubTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [researchCache, setResearchCache] = useState<Partial<Record<keyof ResearchData, CachedTopic>>>(() => {
    try {
      const cachedData = window.localStorage.getItem(CACHE_KEY);
      return cachedData ? JSON.parse(cachedData) : {};
    } catch (error) {
      console.error("Failed to load from local storage", error);
      return {};
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPreCaching, setIsPreCaching] = useState(false);
  const [preCacheProgress, setPreCacheProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);


  const isCacheEmpty = Object.keys(researchCache).length === 0;

  useEffect(() => {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(researchCache));
    } catch (error) {
      console.error("Failed to save to local storage", error);
      // If quota is exceeded, we might want to notify the user, but for now we just log it.
    }
  }, [researchCache]);

  const handleStartFullResearch = useCallback(async () => {
    setIsPreCaching(true);
    setError(null);
    
    // Start with a clean slate
    setResearchCache({});
    window.localStorage.removeItem(CACHE_KEY);

    try {
        for (const topic of topics) {
            // Step 1: Fetch parent topic
            setPreCacheProgress(`Researching: ${topic.title}`);
            const section = await generateResearchForTopic(topic.key);
            setResearchCache(prev => ({
                ...prev,
                [topic.key]: { section, imageUrl: null, subTopics: {} },
            }));

            // Step 2: Fetch details and images for sub-topics
            if (section.subTopics && section.subTopics.length > 0) {
                for (const subTopic of section.subTopics) {
                    setPreCacheProgress(`Detailing: ${subTopic.title}`);
                    const subTopicSection = await generateDetailForSubTopic(section.title, subTopic);
                     setResearchCache(prev => {
                        const newCache = {...prev};
                        if (newCache[topic.key]) {
                            if (!newCache[topic.key]!.subTopics) newCache[topic.key]!.subTopics = {};
                            newCache[topic.key]!.subTopics![subTopic.title] = { section: subTopicSection, imageUrl: null };
                        }
                        return newCache;
                    });

                    setPreCacheProgress(`Generating visual for: ${subTopic.title}`);
                    const imageUrl = await generateImageForResearch(subTopicSection);
                     setResearchCache(prev => {
                        const newCache = {...prev};
                        if (newCache[topic.key]?.subTopics?.[subTopic.title]) {
                           newCache[topic.key]!.subTopics![subTopic.title]!.imageUrl = imageUrl;
                        }
                        return newCache;
                    });
                }
            }
        }
    } catch (err) {
        setError(err instanceof Error ? `Failed during research generation: ${err.message}` : 'An unknown error occurred.');
    } finally {
        setIsPreCaching(false);
        setPreCacheProgress('');
    }
  }, []);

  const generateAndCacheImage = useCallback(async (cacheUpdateFn: (imageUrl: string) => void, sectionData: any) => {
    setLoadingText('Generating visual...');
    setIsLoading(true);
    try {
        const imageUrl = await generateImageForResearch(sectionData);
        cacheUpdateFn(imageUrl);
    } catch (err) {
        throw err; // Rethrow to be caught by the parent try-catch
    } finally {
        setIsLoading(false);
        setLoadingText('');
    }
  }, []);

  const handleSelectTopic = useCallback(async (topicKey: keyof ResearchData) => {
    setSearchQuery('');
    setCurrentTopicKey(topicKey);
    setView('detail');
    setError(null);

    if (researchCache[topicKey]?.section) {
      return; // Already cached
    }

    setLoadingText(`Researching ${topicKey}...`);
    setIsLoading(true);
    try {
      const section = await generateResearchForTopic(topicKey);
      setResearchCache(prev => ({
        ...prev,
        [topicKey]: { section, imageUrl: null, subTopics: {} },
      }));

    } catch (err) {
      setError(err instanceof Error ? `Failed to load topic: ${err.message}` : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  }, [researchCache]);
  
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isLoading) return;

    setView('detail');
    setCurrentTopicKey(null);
    setCurrentSubTopic(null);
    setError(null);
    setIsLoading(true);
    setLoadingText('Researching your question...');

    try {
        const section = await generateAnswerForQuestion(searchQuery);
        const searchKey = `search_${Date.now()}`;
        const newSearchResult: CachedTopic = { section, imageUrl: null, subTopics: {} };
        
        setResearchCache(prev => ({ ...prev, [searchKey]: newSearchResult }));
        setCurrentTopicKey(searchKey as any);

        await generateAndCacheImage((imageUrl) => {
            setResearchCache(prev => ({ ...prev, [searchKey]: { ...prev[searchKey]!, imageUrl } }));
        }, section);

    } catch (err) {
        setError(err instanceof Error ? `Failed to get an answer: ${err.message}` : 'An unknown error occurred.');
    } finally {
        setIsLoading(false);
        setLoadingText('');
    }
  };

  const handleSelectSubTopic = useCallback(async (subTopic: SubTopic) => {
      if (!currentTopicKey) return;
      setCurrentSubTopic(subTopic);
      setError(null);

      const cachedSubTopic = researchCache[currentTopicKey]?.subTopics?.[subTopic.title];
      if (cachedSubTopic?.imageUrl) {
          return; // Fully cached
      }
      
      setLoadingText(`Researching ${subTopic.title}...`);
      setIsLoading(true);

      try {
          let subTopicSection = cachedSubTopic?.section;
          if (!subTopicSection) {
              const currentTopicTitle = researchCache[currentTopicKey]?.section.title || currentTopicKey;
              subTopicSection = await generateDetailForSubTopic(currentTopicTitle, subTopic);
              
              setResearchCache(prev => {
                  const newCache = {...prev};
                  if (newCache[currentTopicKey]) {
                      if (!newCache[currentTopicKey]!.subTopics) {
                          newCache[currentTopicKey]!.subTopics = {};
                      }
                      newCache[currentTopicKey]!.subTopics![subTopic.title] = { section: subTopicSection!, imageUrl: null };
                  }
                  return newCache;
              });
          }
          
          await generateAndCacheImage((imageUrl) => {
              setResearchCache(prev => {
                  const newCache = {...prev};
                  if (newCache[currentTopicKey]?.subTopics?.[subTopic.title]) {
                     newCache[currentTopicKey]!.subTopics![subTopic.title]!.imageUrl = imageUrl;
                  }
                  return newCache;
              });
          }, subTopicSection);

      } catch (err) {
          setError(err instanceof Error ? `Failed to load sub-topic: ${err.message}` : 'An unknown error occurred.');
      } finally {
          setIsLoading(false);
          setLoadingText('');
      }

  }, [currentTopicKey, researchCache, generateAndCacheImage]);


  const handleBack = () => {
    setError(null);
    if (currentSubTopic) {
      setCurrentSubTopic(null);
    } else {
      setView('menu');
      setCurrentTopicKey(null);
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(researchCache, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `5s-research-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        // Basic validation: check if it looks like our object
        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error("Invalid JSON structure");
        }
        
        setResearchCache(parsed);
        alert('Research data imported successfully!');
      } catch (err) {
        console.error("Failed to parse import file", err);
        alert('Failed to import data. The file may be corrupted or invalid.');
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be selected again if needed
    event.target.value = '';
  };

  const renderDetailView = () => {
    const dataKey = currentTopicKey as string;
    if (!dataKey) return null;
    
    const topicData = researchCache[dataKey as keyof ResearchData];
    const subTopicData = (currentTopicKey && currentSubTopic) ? topicData?.subTopics?.[currentSubTopic.title] : null;

    const getBackText = () => {
        if(dataKey.startsWith('search_')) return 'Back to Menu';
        if (currentSubTopic) return `Back to ${topicData?.section.title || 'Topic'}`;
        return 'Back to Menu';
    };

    const renderContent = () => {
        if (isLoading) return <LoadingSpinner text={loadingText} />;
        
        if (error) {
            return (
              <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg text-center" role="alert">
                <h2 className="font-bold text-lg mb-2">Error</h2>
                <p>{error}</p>
              </div>
            );
        }

        if (currentSubTopic && subTopicData) {
            return (
                <SectionCard
                    title={subTopicData.section.title}
                    imageUrl={subTopicData.imageUrl}
                />
            );
        }

        if (topicData?.section) {
            if (topicData.section.subTopics && topicData.section.subTopics.length > 0) {
                return (
                    <div className="w-full animate-fade-in">
                         <h2 className="text-3xl font-bold text-slate-200 mb-2 text-center">{topicData.section.title}</h2>
                         <p className="text-slate-400 text-center mb-8">Select an item to explore its details.</p>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {topicData.section.subTopics.map(sub => (
                                <button
                                    key={sub.title}
                                    onClick={() => handleSelectSubTopic(sub)}
                                    className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-left hover:border-cyan-500/70 hover:bg-slate-800 transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                                >
                                    <h3 className="text-xl font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300">{sub.title}</h3>
                                    <p className="text-slate-400 mt-2 text-sm">{sub.description}</p>
                                </button>
                            ))}
                         </div>
                    </div>
                );
            }
            return (
                <SectionCard 
                    title={topicData.section.title} 
                    imageUrl={topicData.imageUrl}
                />
            );
        }
        
        return null;
    };

    return (
      <div className="w-full max-w-5xl flex flex-col items-center animate-fade-in">
        <div className="w-full mb-8">
            <button 
                onClick={handleBack}
                aria-label={getBackText()}
                className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors duration-300 group"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 transform group-hover:-translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                {getBackText()}
            </button>
        </div>
        {renderContent()}
      </div>
    );
  };
  
  const renderPresentationView = () => {
    const slideDeck: { title: string; imageUrl: string | null }[] = [];

    const orderedKeys = topics.map(t => t.key);
    
    orderedKeys.forEach(key => {
        const topicData = researchCache[key];
        if (topicData?.subTopics) {
            Object.values(topicData.subTopics).forEach(subTopicCache => {
                if (subTopicCache.imageUrl) {
                    slideDeck.push({
                        title: subTopicCache.section.title,
                        imageUrl: subTopicCache.imageUrl,
                    });
                }
            });
        }
    });

    Object.keys(researchCache).forEach(key => {
        if (key.startsWith('search_')) {
            const searchData = researchCache[key as keyof ResearchData];
            if (searchData.imageUrl) {
                slideDeck.push({
                    title: searchData.section.title,
                    imageUrl: searchData.imageUrl,
                });
            }
        }
    });


    return (
        <div className="presentation-container w-full">
            <div className="presentation-controls p-4 bg-slate-900/80 backdrop-blur-sm fixed top-0 left-0 right-0 z-50 flex justify-center items-center gap-4">
                <h2 className="text-xl font-bold text-slate-200 hidden sm:block">Presentation Mode</h2>
                <button
                    onClick={() => window.print()}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7V9h6v3z" clipRule="evenodd" /></svg>
                    Export to PDF
                </button>
                <button
                    onClick={() => setView('menu')}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    Exit
                </button>
            </div>
            <div className="pt-24">
                {slideDeck.length > 0 ? (
                    slideDeck.map(slide => <PresentationSlide key={slide.title} slide={slide} />)
                ) : (
                    <div className="text-center text-slate-400">
                        <p>No content has been generated yet.</p>
                        <p>Go back and explore some topics to create a presentation.</p>
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderContent = () => {
    switch (view) {
        case 'menu':
            if (isPreCaching) {
                return (
                    <div className="text-center">
                        <LoadingSpinner text={preCacheProgress || 'Building knowledge base...'} />
                        <p className="text-slate-400 mt-4">This may take a few minutes. Please don't close this tab.</p>
                    </div>
                );
            }

            if (isCacheEmpty) {
                return (
                    <div className="text-center max-w-2xl animate-fade-in">
                        <h2 className="text-3xl font-bold text-slate-200 mb-4">Welcome to the 5S Deep Dive</h2>
                        <p className="text-slate-400 mb-8">
                            This tool generates a comprehensive research report. To begin,
                            click the button below to perform the initial research. This will gather all
                            the necessary data and visuals and may take a few minutes.
                        </p>
                        {error && <p className="text-red-400 mb-4">Error during last attempt: {error}</p>}
                        <button
                            onClick={handleStartFullResearch}
                            disabled={isPreCaching}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            Start Initial Research
                        </button>
                        <div className="mt-6 border-t border-slate-800 pt-6">
                            <p className="text-slate-500 text-sm mb-4">Or import a previously saved research file:</p>
                             <button
                                onClick={handleImportClick}
                                className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-slate-500"
                            >
                                Import Research File
                            </button>
                        </div>
                    </div>
                );
            }

            return (
                <div className="w-full max-w-5xl animate-fade-in">
                    <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-slate-200 mb-2">Ask a Question or Select a Topic</h2>
                    <p className="text-slate-400">Ask anything about 5S or dive into a specific area.</p>
                    </div>

                    <form onSubmit={handleSearchSubmit} className="mb-10 flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="e.g., How does 5S improve safety?"
                            className="flex-grow bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                            aria-label="Ask a question about 5S"
                        />
                        <button
                            type="submit"
                            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:bg-slate-600 disabled:cursor-not-allowed"
                            disabled={isLoading || !searchQuery.trim()}
                        >
                            {isLoading ? 'Asking...' : 'Ask'}
                        </button>
                    </form>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topics.map((topic) => (
                        <button
                        key={topic.key}
                        onClick={() => handleSelectTopic(topic.key)}
                        className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-left hover:border-cyan-500/70 hover:bg-slate-800 transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                        >
                        <h3 className="text-xl font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300">{topic.title}</h3>
                        <p className="text-slate-400 mt-2 text-sm">{topic.description}</p>
                        </button>
                    ))}
                    </div>
                </div>
            );
        case 'detail':
            return renderDetailView();
        case 'present':
            return renderPresentationView();
        default:
            return null;
    }
  }


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col items-center p-4 sm:p-6 md:p-8">
      <header className="w-full max-w-5xl text-center mb-8 flex justify-between items-center">
        <div className="text-left">
            <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400 mb-2">5S Methodology Deep Dive</h1>
            <p className="text-lg text-slate-400">A visual exploration of the cornerstone of lean manufacturing.</p>
        </div>
        {view !== 'present' && (
            <button 
                onClick={() => setView('present')}
                disabled={isCacheEmpty}
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2"
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                Present / Export
            </button>
        )}
      </header>

      <main className="w-full max-w-5xl flex-grow flex flex-col items-center justify-center">
        {renderContent()}
      </main>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="application/json" 
        onChange={handleFileChange} 
      />

      {view !== 'present' && !isCacheEmpty && (
        <footer className="w-full max-w-5xl mt-8 text-slate-500 text-sm border-t border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <p>Powered by Google Gemini. Visuals generated by AI.</p>
            </div>
            <div className="flex gap-4">
                 <button 
                    onClick={handleExportData}
                    className="text-cyan-500 hover:text-cyan-400 transition-colors"
                >
                    Export Research Data
                </button>
                <span className="text-slate-700">|</span>
                <button 
                    onClick={handleImportClick}
                    className="text-cyan-500 hover:text-cyan-400 transition-colors"
                >
                    Import Research Data
                </button>
                <span className="text-slate-700">|</span>
                <button 
                    onClick={handleStartFullResearch} 
                    disabled={isPreCaching} 
                    className="text-cyan-500 hover:text-cyan-400 transition-colors disabled:text-slate-600 disabled:cursor-wait"
                >
                    {isPreCaching ? 'Refreshing...' : 'Refresh All Research'}
                </button>
            </div>
        </footer>
      )}
    </div>
  );
};

export default App;
