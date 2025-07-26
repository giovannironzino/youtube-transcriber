// Arquivo: src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, serverTimestamp } from 'firebase/firestore';

// ADICIONADO: Importa a configuração do Firebase do nosso novo arquivo.
import { firebaseConfig } from './firebaseConfig.js';

// REMOVIDO: As variáveis antigas que dependiam do ambiente "Canvas".

// Componente principal do aplicativo
const App = () => {
    // Estados do Firebase
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Estados do aplicativo
    const [videoUrl, setVideoUrl] = useState('');
    const [analysisReport, setAnalysisReport] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedSections, setExpandedSections] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [reportsHistory, setReportsHistory] = useState([]);
    const [selectedReportId, setSelectedReportId] = useState(null);

    // Inicialização do Firebase e autenticação
    useEffect(() => {
        try {
            // Usa a configuração importada para inicializar o Firebase
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authentication = getAuth(app);

            setDb(firestore);
            setAuth(authentication);

            const unsubscribe = onAuthStateChanged(authentication, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // SIMPLIFICADO: Agora só tenta a autenticação anônima.
                    try {
                        await signInAnonymously(authentication);
                    } catch (authError) {
                        console.error("Erro na autenticação Firebase:", authError);
                        setError("Falha na autenticação. Tente novamente.");
                        setModalMessage("Falha na autenticação. Tente novamente.");
                        setShowModal(true);
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (initError) {
            console.error("Erro ao inicializar Firebase:", initError);
            setError("Falha ao inicializar o Firebase. Verifique a configuração.");
            setModalMessage("Falha ao inicializar o Firebase. Verifique a configuração.");
            setShowModal(true);
        }
    }, []);

    // Carregar histórico de relatórios
    useEffect(() => {
        if (db && userId && isAuthReady) {
            // SIMPLIFICADO: Caminho do banco de dados mais simples.
            const reportsColRef = collection(db, `users/${userId}/reports`);
            const q = query(reportsColRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const reports = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setReportsHistory(reports.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate()));
            }, (err) => {
                console.error("Erro ao carregar histórico de relatórios:", err);
                setError("Não foi possível carregar o histórico de relatórios.");
            });

            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady]);

    // Carregar relatório selecionado do histórico
    const loadReportFromHistory = useCallback(async (reportId) => {
        if (!db || !userId) return;
        setIsLoading(true);
        setError(null);
        try {
            // SIMPLIFICADO: Caminho do banco de dados mais simples.
            const reportDocRef = doc(db, `users/${userId}/reports`, reportId);
            const docSnap = await getDoc(reportDocRef);
            if (docSnap.exists()) {
                setAnalysisReport(docSnap.data());
                setSelectedReportId(reportId);
            } else {
                setError("Relatório não encontrado.");
            }
        } catch (err) {
            console.error("Erro ao carregar relatório do histórico:", err);
            setError("Erro ao carregar relatório do histórico.");
        } finally {
            setIsLoading(false);
        }
    }, [db, userId]);

    // REMOVIDO: Funções callGeminiAPI e analyzeSection, pois a lógica agora está no backend.

    // Função principal para iniciar a análise (CONECTADA AO BACKEND)
    const handleAnalyzeVideo = async () => {
        if (!db || !userId) {
            setModalMessage("Firebase não inicializado ou usuário não autenticado. Tente novamente.");
            setShowModal(true);
            return;
        }

        if (!videoUrl) {
            setModalMessage("Por favor, insira uma URL do YouTube para análise.");
            setShowModal(true);
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisReport(null);
        setSelectedReportId(null);
        setExpandedSections({});

        try {
            // ETAPA 1: CHAMAR O BACKEND PARA OBTER A TRANSCRIÇÃO
            const transcriptApiUrl = `https://youtube-transcriber.onrender.com/transcript?videoUrl=${encodeURIComponent(videoUrl)}`;
            
            const transcriptResponse = await fetch(transcriptApiUrl);
            const transcriptData = await transcriptResponse.json();

            if (!transcriptResponse.ok) {
                throw new Error(transcriptData.error || "Falha ao obter a transcrição.");
            }

            const { transcription } = transcriptData;

            // ETAPA 2: CHAMAR O BACKEND PARA ANÁLISE
            const analysisPayload = {
                simulatedVideoData: {
                    transcription: transcription,
                    // Outros campos podem ser preenchidos ou analisados pela IA no futuro
                }
            };

            const analyzeApiUrl = `https://youtube-transcriber.onrender.com/analyze`;
            const analyzeResponse = await fetch(analyzeApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(analysisPayload)
            });

            const analysisData = await analyzeResponse.json();

            if (!analyzeResponse.ok) {
                throw new Error(analysisData.error || "Falha ao gerar a análise.");
            }

            // ETAPA 3: SALVAR RELATÓRIO NO FIRESTORE
            // SIMPLIFICADO: Caminho do banco de dados mais simples.
            const newReportRef = doc(collection(db, `users/${userId}/reports`));
            const reportToSave = {
                videoUrl: videoUrl,
                reportData: analysisData.reportData,
                timestamp: serverTimestamp(),
                userId: userId
            };
            
            await setDoc(newReportRef, reportToSave);
            
            setAnalysisReport(reportToSave);
            setSelectedReportId(newReportRef.id);
            setModalMessage("Análise concluída e relatório salvo com sucesso!");
            setShowModal(true);

        } catch (err) {
            console.error("Erro durante a análise:", err);
            setError(`Erro: ${err.message}. Verifique a URL e tente novamente.`);
            setModalMessage(`Erro: ${err.message}`);
            setShowModal(true);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSection = (sectionKey) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    const handleExportPdf = () => setModalMessage("Funcionalidade de exportar para PDF em desenvolvimento.");
    const handleEditReport = () => setModalMessage("Funcionalidade de edição manual em desenvolvimento.");
    const handleCompareVideos = () => setModalMessage("Funcionalidade de comparação de vídeos em desenvolvimento.");

    const Modal = ({ message, onClose }) => (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                <p className="text-lg font-semibold mb-4">{message}</p>
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300"
                >
                    Fechar
                </button>
            </div>
        </div>
    );

    const sectionsMap = {
        secao1: { title: "1. Conteúdo Verbal", description: "Análise da mensagem explícita e implícita, tipo discursivo e coerência." },
        secao2: { title: "2. Estrutura Expressiva", description: "Análise de entonação, gestos, ritmo e impacto na credibilidade." },
        secao3: { title: "3. Situação Comunicativa", description: "Identificação de emissor, destinatário, contexto e contrato comunicacional." },
        secao4: { title: "4. Sistema de Signos Visuais e Sonoros", description: "Detecção e avaliação de elementos visuais e sonoros e montagem." },
        secao5: { title: "5. Efeitos Cognitivos e Emocionais", description: "Identificação de emoções ativadas, gatilhos e adequação ao público." },
        secao6: { title: "6. Síntese e Coerência Global", description: "Elementos nucleares da mensagem e integração multimodal." },
        secao7: { title: "7. Aspectos Técnicos", description: "Nível técnico de captação, acessibilidade e percepção de profissionalismo." },
        secao8: { title: "8. Potencial de Uso Estratégico", description: "Aplicação em marketing, canais, público e métricas esperadas." },
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 font-sans text-gray-800 p-4 sm:p-8">
            {/* Estes links são carregados dinamicamente, o que é ok para protótipos */}
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
            <script src="https://cdn.tailwindcss.com"></script>

            {showModal && <Modal message={modalMessage} onClose={() => setShowModal(false)} />}

            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl p-6 sm:p-10 border border-gray-200">
                <h1 className="text-4xl font-extrabold text-center text-blue-700 mb-8">
                    Análise Multicamadas de Vídeos
                </h1>

                {isAuthReady && userId && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 text-sm text-center">
                        Seu ID de Usuário: <span className="font-mono break-all">{userId}</span>
                    </div>
                )}

                <div className="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner border border-blue-200">
                    <h2 className="text-2xl font-bold text-blue-600 mb-4">Entrada de Vídeo</h2>
                    <div className="mb-4">
                        <label htmlFor="videoUrl" className="block text-gray-700 text-sm font-medium mb-2">
                            URL do YouTube:
                        </label>
                        <input
                            type="text"
                            id="videoUrl"
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            placeholder="Cole a URL de um vídeo do YouTube aqui"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        onClick={handleAnalyzeVideo}
                        className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition duration-300 ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'}`}
                        disabled={isLoading || !isAuthReady}
                    >
                        {isLoading ? 'Analisando...' : 'Analisar Vídeo'}
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6">
                        <strong className="font-bold">Erro:</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                )}

                {reportsHistory.length > 0 && (
                     <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner border border-gray-200">
                        <h2 className="text-2xl font-bold text-gray-700 mb-4">Histórico de Relatórios</h2>
                        <ul className="space-y-3">
                            {reportsHistory.map(report => (
                                <li key={report.id} className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm border border-gray-100">
                                    <span className="text-sm font-medium text-gray-700 truncate">
                                        URL: {report.videoUrl}
                                    </span>
                                    <button
                                        onClick={() => loadReportFromHistory(report.id)}
                                        className={`ml-4 px-4 py-2 text-sm rounded-md transition duration-300 ${selectedReportId === report.id ? 'bg-green-500 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                                        disabled={isLoading}
                                    >
                                        {selectedReportId === report.id ? 'Carregado' : 'Carregar'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {analysisReport && (
                    <div className="mt-10 p-6 bg-white rounded-xl shadow-2xl border border-gray-200">
                        <h2 className="text-3xl font-bold text-blue-700 mb-6 text-center">Relatório de Análise</h2>
                        <p className="text-gray-600 text-center mb-6">
                            Vídeo Analisado: <span className="font-semibold">{analysisReport.videoUrl}</span>
                        </p>

                        {Object.keys(analysisReport.reportData || {}).map(key => {
                            const sectionData = analysisReport.reportData[key];
                            const { title, description } = sectionsMap[key] || {};
                            if (!title) return null; // Ignora seções não mapeadas
                            const isExpanded = expandedSections[key];

                            return (
                                <div key={key} className="mb-4 bg-blue-50 rounded-lg shadow-md border border-blue-200">
                                    <button
                                        className="w-full flex justify-between items-center p-4 text-left font-semibold text-lg text-blue-800 focus:outline-none"
                                        onClick={() => toggleSection(key)}
                                    >
                                        {title}
                                        {/* SVG para ícone de expandir/recolher */}
                                    </button>
                                    {isExpanded && (
                                        <div className="p-4 border-t border-blue-200 bg-white rounded-b-lg">
                                            {/* Renderização do conteúdo da seção */}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
