import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Variáveis globais fornecidas pelo ambiente Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// Correção: Alterado __firebase_firebaseConfig para __firebase_config
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Componente principal do aplicativo
const App = () => {
    // Estados do Firebase
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Estados do aplicativo
    const [videoUrl, setVideoUrl] = useState('');
    // Removido: const [simulatedContent, setSimulatedContent] = useState('');
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
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authentication = getAuth(app);

            setDb(firestore);
            setAuth(authentication);

            // Listener para o estado de autenticação
            const unsubscribe = onAuthStateChanged(authentication, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // Se não houver usuário, tenta autenticar com token ou anonimamente
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(authentication, initialAuthToken);
                        } else {
                            await signInAnonymously(authentication);
                        }
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

    // Carregar histórico de relatórios quando o userId estiver disponível
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const reportsColRef = collection(db, `artifacts/${appId}/users/${userId}/reports`);
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
                setModalMessage("Não foi possível carregar o histórico de relatórios.");
                setShowModal(true);
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
            const reportDocRef = doc(db, `artifacts/${appId}/users/${userId}/reports`, reportId);
            const docSnap = await getDoc(reportDocRef);
            if (docSnap.exists()) {
                setAnalysisReport(docSnap.data());
                setSelectedReportId(reportId);
                setModalMessage("Relatório carregado com sucesso!");
                setShowModal(true);
            } else {
                setError("Relatório não encontrado.");
                setModalMessage("Relatório não encontrado.");
                setShowModal(true);
            }
        } catch (err) {
            console.error("Erro ao carregar relatório do histórico:", err);
            setError("Erro ao carregar relatório do histórico.");
            setModalMessage("Erro ao carregar relatório do histórico.");
            setShowModal(true);
        } finally {
            setIsLoading(false);
        }
    }, [db, userId]);

    // Função para chamar a API Gemini (mantida para referência, mas a análise agora vem do backend)
    const callGeminiAPI = async (prompt, schema) => {
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema
            }
        };
        const apiKey = ""; // A chave API será fornecida pelo ambiente Canvas
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const jsonString = result.candidates[0].content.parts[0].text;
                return JSON.parse(jsonString);
            } else {
                throw new Error("Resposta da API Gemini inesperada.");
            }
        } catch (apiError) {
            console.error("Erro ao chamar a API Gemini:", apiError);
            throw apiError;
        }
    };

    // Função para gerar análise para uma seção específica (agora chamada pelo backend)
    // Esta função não é mais diretamente chamada no frontend, mas seu conteúdo é um modelo
    // do que o backend faria ao usar a API Gemini.
    const analyzeSection = async (sectionNumber, simulatedVideoData) => {
        let prompt = '';
        let schema = {};

        switch (sectionNumber) {
            case 1: // Conteúdo Verbal
                prompt = `Analise o seguinte conteúdo de vídeo simulado para a Seção 1 (Conteúdo Verbal). O vídeo tem a seguinte transcrição: '${simulatedVideoData.transcription}'. Identifique a mensagem central explícita, possíveis mensagens implícitas/simbólicas/subversivas. Reconheça o tipo discursivo predominante (narrativo, expositivo, argumentativo, injuntivo), a natureza da fala (autoridade, experiência ou emoção). Avalie a clareza, coerência e progressão temática, identificando pressupostos não ditos, registros linguísticos mistos e inferências. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        identificacao: {
                            type: "OBJECT",
                            properties: {
                                mensagemCentralExplicita: { type: "STRING" },
                                mensagensImplicitasSimbolicasSubversivas: { type: "ARRAY", items: { type: "STRING" } },
                                tipoDiscursivoPredominante: { type: "STRING", enum: ["narrativo", "expositivo", "argumentativo", "injuntivo", "N/A"] },
                                naturezaDaFala: { type: "STRING", enum: ["autoridade", "experiencia", "emocao", "N/A"] }
                            }
                        },
                        avaliacao: {
                            type: "OBJECT",
                            properties: {
                                clarezaCoerenciaProgressaoTematica: { type: "STRING" },
                                pressupostosNaoDitos: { type: "ARRAY", items: { type: "STRING" } },
                                registrosLinguisticosMistos: { type: "ARRAY", items: { type: "STRING" } },
                                inferencias: { type: "ARRAY", items: { type: "STRING" } }
                            }
                        }
                    }
                };
                break;
            case 2: // Estrutura Expressiva
                prompt = `Analise o seguinte conteúdo de vídeo simulado para a Seção 2 (Estrutura Expressiva). O vídeo tem a seguinte transcrição: '${simulatedVideoData.transcription}' e descrição visual/expressiva: '${simulatedVideoData.expressiveDescription}'. Capture os recursos expressivos como entonação, pausas, gestos, contato visual, variação de ritmo e avalie o alinhamento desses elementos à intenção comunicativa. Identifique se a entrega soa ensaiada, espontânea ou performática, e avalie se há amplificação ou obscurecimento da mensagem por figuras retóricas (metáforas, repetições, ironias). Aferir se o vídeo transmite credibilidade, carisma ou autoridade, com base na expressividade. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        identificacao: {
                            type: "OBJECT",
                            properties: {
                                recursosExpressivos: { type: "ARRAY", items: { type: "STRING" } },
                                tipoDeEntrega: { type: "STRING", enum: ["ensaiada", "espontanea", "performatica", "N/A"] },
                                figurasRetoricas: { type: "ARRAY", items: { type: "STRING" } }
                            }
                        },
                        avaliacao: {
                            type: "OBJECT",
                            properties: {
                                alinhamentoIntencaoComunicativa: { type: "STRING" },
                                amplificacaoObscurecimentoMensagem: { type: "STRING" },
                                transmiteCredibilidadeCarismaAutoridade: { type: "STRING" }
                            }
                        }
                    }
                };
                break;
            case 3: // Situação Comunicativa
                prompt = `Analise o seguinte conteúdo de vídeo simulado para a Seção 3 (Situação Comunicativa). O vídeo tem a seguinte transcrição: '${simulatedVideoData.transcription}' e descrição de contexto: '${simulatedVideoData.contextDescription}'. Identifique o emissor (incluindo posição simbólica, social ou institucional), o destinatário presumido, o contexto sociocultural/histórico e o tipo de contrato comunicacional (institucional, íntimo, informal). Avalie a coerência entre quem fala, como fala e para quem fala — identificando vínculos, deslocamentos ou incoerências discursivas. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        identificacao: {
                            type: "OBJECT",
                            properties: {
                                emissor: { type: "STRING" },
                                destinatarioPresumido: { type: "STRING" },
                                contextoSocioculturalHistorico: { type: "STRING" },
                                tipoContratoComunicacional: { type: "STRING", enum: ["institucional", "intimo", "informal", "N/A"] }
                            }
                        },
                        avaliacao: {
                            type: "OBJECT",
                            properties: {
                                coerenciaComunicativa: { type: "STRING" },
                                vinculosDeslocamentosIncoerencias: { type: "ARRAY", items: { type: "STRING" } }
                            }
                        }
                    }
                };
                break;
            case 4: // Sistema de Signos Visuais e Sonoros
                prompt = `Analise o seguinte conteúdo de vídeo simulado para a Seção 4 (Sistema de Signos Visuais e Sonoros). O vídeo tem a seguinte descrição visual e sonora: '${simulatedVideoData.visualAudioDescription}'. Detecte elementos visuais e sonoros em destaque (cenário, objetos, trilha, edição, símbolos, enquadramento, cor), com avaliação sobre sua função simbólica ou meramente decorativa. A montagem (cortes, ritmo, efeitos) deverá ser considerada em relação à clareza, retenção, emoção ou reforço da narrativa. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        identificacao: {
                            type: "OBJECT",
                            properties: {
                                elementosVisuaisEmDestaque: { type: "ARRAY", items: { type: "STRING" } },
                                elementosSonorosEmDestaque: { type: "ARRAY", items: { type: "STRING" } },
                                montagem: { type: "STRING" }
                            }
                        },
                        avaliacao: {
                            type: "OBJECT",
                            properties: {
                                funcaoSimbolicaDecorativa: { type: "STRING" },
                                montagemImpacto: { type: "STRING" }
                            }
                        }
                    }
                };
                break;
            case 5: // Efeitos Cognitivos e Emocionais
                prompt = `Analise o seguinte conteúdo de vídeo simulado para a Seção 5 (Efeitos Cognitivos e Emocionais). O vídeo tem a seguinte transcrição: '${simulatedVideoData.transcription}' e descrição visual/sonora: '${simulatedVideoData.visualAudioDescription}'. Identifique emoções ativadas (ex: empatia, euforia, desconforto), gatilhos psicológicos (ex: escassez, autoridade, prova social), e a natureza da resposta (transitória, memorável, contraditória). Avalie se o estímulo cognitivo exigido é ativo ou passivo e se está adequado ao público-alvo. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        identificacao: {
                            type: "OBJECT",
                            properties: {
                                emocoesAtivadas: { type: "ARRAY", items: { type: "STRING" } },
                                gatilhosPsicologicos: { type: "ARRAY", items: { type: "STRING" } },
                                naturezaDaResposta: { type: "STRING", enum: ["transitoria", "memoravel", "contraditoria", "N/A"] }
                            }
                        },
                        avaliacao: {
                            type: "OBJECT",
                            properties: {
                                estimuloCognitivoExigido: { type: "STRING", enum: ["ativo", "passivo", "N/A"] },
                                adequacaoAoPublicoAlvo: { type: "STRING" }
                            }
                        }
                    }
                };
                break;
            case 6: // Síntese e Coerência Global
                prompt = `Analise o seguinte conteúdo de vídeo simulado para a Seção 6 (Síntese e Coerência Global). O vídeo tem a seguinte transcrição: '${simulatedVideoData.transcription}', descrição visual/sonora: '${simulatedVideoData.visualAudioDescription}' e descrição expressiva: '${simulatedVideoData.expressiveDescription}'. Identifique os elementos nucleares da mensagem e da integração entre fala, imagem e som. Avalie se a multimodalidade (verbal, visual, sonora) opera de forma convergente, fluida e inteligível — ou se há ruídos, desvios ou contradições internas. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        identificacao: {
                            type: "OBJECT",
                            properties: {
                                elementosNuclearesDaMensagem: { type: "ARRAY", items: { type: "STRING" } },
                                integracaoMultimodal: { type: "STRING" }
                            }
                        },
                        avaliacao: {
                            type: "OBJECT",
                            properties: {
                                operacaoMultimodalidade: { type: "STRING" },
                                ruidosDesviosContradicoes: { type: "ARRAY", items: { type: "STRING" } }
                            }
                        }
                    }
                };
                break;
            case 7: // Aspectos Técnicos
                prompt = `Analise o seguinte conteúdo de vídeo simulado para a Seção 7 (Aspectos Técnicos). O vídeo tem a seguinte descrição técnica: '${simulatedVideoData.technicalDescription}'. Identifique o nível técnico da captação (áudio, vídeo, iluminação), e avalie a presença ou ausência de recursos de acessibilidade (ex: legendas, Libras). A qualidade técnica será correlacionada à percepção de profissionalismo ou precariedade (intencional ou não), além do impacto na recepção da mensagem. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        identificacao: {
                            type: "OBJECT",
                            properties: {
                                nivelTecnicoCaptacao: { type: "STRING" },
                                recursosAcessibilidade: { type: "ARRAY", items: { type: "STRING" } }
                            }
                        },
                        avaliacao: {
                            type: "OBJECT",
                            properties: {
                                qualidadeTecnicaCorrelacao: { type: "STRING" },
                                impactoNaRecepcao: { type: "STRING" }
                            }
                        }
                    }
                };
                break;
            case 8: // Potencial de Uso Estratégico
                prompt = `Analise o seguinte conteúdo de vídeo simulado para a Seção 8 (Potencial de Uso Estratégico). O vídeo tem a seguinte transcrição: '${simulatedVideoData.transcription}' e descrição de público-alvo: '${simulatedVideoData.targetAudience}'. Faça uma leitura de aplicação em marketing, com sugestões de canais e formatos mais eficazes (Instagram, YouTube Ads, Reels, institucional), análise do perfil de público com maior engajamento previsto e recomendação sobre recortes, reaproveitamento de conteúdo e métricas esperadas (ex: taxa de visualização até o fim, cliques, compartilhamentos, ROI). Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        identificacao: {
                            type: "OBJECT",
                            properties: {
                                canaisFormatosSugeridos: { type: "ARRAY", items: { type: "STRING" } },
                                perfilPublicoEngajamentoPrevisto: { type: "STRING" },
                                recomendacoesConteudo: { type: "ARRAY", items: { type: "STRING" } }
                            }
                        },
                        avaliacao: {
                            type: "OBJECT",
                            properties: {
                                metricasEsperadas: { type: "ARRAY", items: { type: "STRING" } }
                            }
                        }
                    }
                };
                break;
            default:
                throw new Error("Seção de análise inválida.");
        }

        return await callGeminiAPI(prompt, schema);
    };

    // Função principal para iniciar a análise
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
            // --- ETAPA 1: CHAMAR NOSSO BACKEND PARA OBTER A TRANSCRIÇÃO ---
            // Substitua 'https://youtube-transcriber.onrender.com' pela URL real do seu serviço no Render
            const transcriptApiUrl = `https://youtube-transcriber.onrender.com/transcript?videoUrl=${encodeURIComponent(videoUrl)}`;
            
            const transcriptResponse = await fetch(transcriptApiUrl);
            const transcriptData = await transcriptResponse.json();

            if (!transcriptResponse.ok) {
                throw new Error(transcriptData.error || "Falha ao obter a transcrição.");
            }

            const { transcription } = transcriptData;

            // --- ETAPA 2: PREPARAR DADOS E CHAMAR NOSSO BACKEND PARA ANÁLISE ---
            // Usamos a transcrição real e mantemos os outros dados como simulação por enquanto
            const analysisPayload = {
                simulatedVideoData: {
                    transcription: transcription,
                    expressiveDescription: "A ser analisado pela IA",
                    contextDescription: "A ser analisado pela IA",
                    visualAudioDescription: "A ser analisado pela IA",
                    technicalDescription: "A ser analisado pela IA",
                    targetAudience: "A ser analisado pela IA"
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

            // --- ETAPA 3: SALVAR RELATÓRIO NO FIRESTORE ---
            const newReportRef = doc(collection(db, `artifacts/${appId}/users/${userId}/reports`));
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

    // Função para alternar a expansão de uma seção
    const toggleSection = (sectionKey) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    // Função para exportar para PDF (placeholder)
    const handleExportPdf = () => {
        setModalMessage("A funcionalidade de exportar para PDF está em desenvolvimento.");
        setShowModal(true);
    };

    // Função para edição manual (placeholder)
    const handleEditReport = () => {
        setModalMessage("A funcionalidade de edição manual está em desenvolvimento.");
        setShowModal(true);
    };

    // Função para comparação de vídeos (placeholder)
    const handleCompareVideos = () => {
        setModalMessage("A funcionalidade de comparação de vídeos está em desenvolvimento.");
        setShowModal(true);
    };

    // Componente Modal simples
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

    // Mapeamento das seções para exibição
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
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
            <script src="https://cdn.tailwindcss.com"></script>

            {showModal && <Modal message={modalMessage} onClose={() => setShowModal(false)} />}

            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl p-6 sm:p-10 border border-gray-200">
                <h1 className="text-4xl font-extrabold text-center text-blue-700 mb-8">
                    Análise Multicamadas de Vídeos
                </h1>

                {/* Exibição do User ID */}
                {isAuthReady && userId && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 text-sm text-center">
                        Seu ID de Usuário: <span className="font-mono break-all">{userId}</span>
                    </div>
                )}

                {/* Input Section */}
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
                            placeholder="Ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    {/* Removido: <div className="text-center text-gray-500 mb-4">- OU -</div> */}
                    {/* Removido: Conteúdo de Vídeo Simulado (Texto) */}
                    <button
                        onClick={handleAnalyzeVideo}
                        className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition duration-300 ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'}`}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analisando...
                            </div>
                        ) : (
                            'Analisar Vídeo'
                        )}
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6">
                        <strong className="font-bold">Erro:</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                )}

                {/* Histórico de Relatórios */}
                {reportsHistory.length > 0 && (
                    <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner border border-gray-200">
                        <h2 className="text-2xl font-bold text-gray-700 mb-4">Histórico de Relatórios</h2>
                        <ul className="space-y-3">
                            {reportsHistory.map(report => (
                                <li key={report.id} className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm border border-gray-100">
                                    <span className="text-sm font-medium text-gray-700 truncate">
                                        {report.videoUrl === 'Conteúdo Simulado' ? `Simulado: ${report.simulatedContent?.substring(0, 50)}...` : `URL: ${report.videoUrl}`}
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

                {/* Analysis Report Display */}
                {analysisReport && (
                    <div className="mt-10 p-6 bg-white rounded-xl shadow-2xl border border-gray-200">
                        <h2 className="text-3xl font-bold text-blue-700 mb-6 text-center">Relatório de Análise</h2>
                        <p className="text-gray-600 text-center mb-6">
                            Vídeo Analisado: <span className="font-semibold">{analysisReport.videoUrl}</span>
                        </p>

                        {Object.keys(sectionsMap).map(key => {
                            const sectionData = analysisReport.reportData[key];
                            const { title, description } = sectionsMap[key];
                            const isExpanded = expandedSections[key];

                            return (
                                <div key={key} className="mb-4 bg-blue-50 rounded-lg shadow-md border border-blue-200">
                                    <button
                                        className="w-full flex justify-between items-center p-4 text-left font-semibold text-lg text-blue-800 focus:outline-none"
                                        onClick={() => toggleSection(key)}
                                    >
                                        {title}
                                        <svg
                                            className={`w-6 h-6 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                        </svg>
                                    </button>
                                    {isExpanded && (
                                        <div className="p-4 border-t border-blue-200 bg-white rounded-b-lg">
                                            <p className="text-gray-600 text-sm mb-4">{description}</p>
                                            {sectionData ? (
                                                <>
                                                    <h3 className="text-md font-bold text-blue-700 mb-2">Identificação:</h3>
                                                    <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
                                                        {Object.entries(sectionData.identificacao || {}).map(([idKey, idValue]) => (
                                                            <li key={idKey}>
                                                                <span className="font-semibold">{idKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>{' '}
                                                                {Array.isArray(idValue) ? idValue.join(', ') : idValue || 'N/A'}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <h3 className="text-md font-bold text-blue-700 mb-2">Avaliação:</h3>
                                                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                                                        {Object.entries(sectionData.avaliacao || {}).map(([evalKey, evalValue]) => (
                                                            <li key={evalKey}>
                                                                <span className="font-semibold">{evalKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>{' '}
                                                                {Array.isArray(evalValue) ? evalValue.join(', ') : evalValue || 'N/A'}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </>
                                            ) : (
                                                <p className="text-gray-500">N/A - Dados de análise não disponíveis para esta seção.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                            <button
                                onClick={handleExportPdf}
                                className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition duration-300 shadow-lg"
                            >
                                Exportar Relatório (PDF)
                            </button>
                            <button
                                onClick={handleEditReport}
                                className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-700 transition duration-300 shadow-lg"
                            >
                                Editar Relatório
                            </button>
                            <button
                                onClick={handleCompareVideos}
                                className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-orange-600 hover:bg-orange-700 transition duration-300 shadow-lg"
                            >
                                Comparar Vídeos
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;

