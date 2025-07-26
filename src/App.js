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
            const reports
