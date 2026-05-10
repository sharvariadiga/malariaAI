import { useState, useRef, useEffect } from 'react';

// ─── Multilingual Diagnostic Knowledge Base (Full 11-Language Support) ───────
const LOCALIZED_RESPONSES = {
  en: {
    about: "# About Malaria\nMalaria is a disease caused by *Plasmodium* parasites and transmitted through *Anopheles* mosquitoes.\n\n### Main Species:\n• **P. falciparum** (Most deadly)\n• **P. vivax** (Widespread)\n• **P. malariae**\n• **P. ovale**\n• **P. knowlesi**",
    symptoms: "# Symptoms\nClassic symptoms include:\n• **High Fever**\n• **Severe Chills**\n• **Sweating**\n• **Headache & Muscle Pain**\n\n🚨 Seek care if you have altered consciousness or dark urine.",
    treatment: "# Treatment (WHO)\n• **Falciparum:** ACT therapy (Artemether-Lumefantrine).\n• **Vivax:** Chloroquine + Primaquine.\n\n⚠️ *G6PD test is required before Primaquine.*",
    prevention: "# Prevention\n• Use **ITN** bed nets.\n• Spray walls with **IRS**.\n• Use mosquito repellent and wear long sleeves.",
    fallback: "I'm not sure. Try asking about **Symptoms**, **Treatment**, or **Species**."
  },
  hi: {
    about: "# मलेरिया के बारे में\nमलेरिया एक बीमारी है जो *प्लाज्मोडियम* परजीवियों के कारण होती है और *एनोफेलीज* मच्छरों के माध्यम से फैलती है।",
    symptoms: "# लक्षण\n• तेज बुखार\n• कंपकंपी के साथ ठंड\n• पसीना आना\n• सिरदर्द और मांसपेशियों में दर्द",
    treatment: "# उपचार (WHO)\n• फाल्सीपेरम: ACT थेरेपी।\n• वाइवैक्स: क्लोरोक्वीन + प्राइमाक्विन।",
    prevention: "# बचाव\n• मच्छरदानी का उपयोग करें।\n• पूरी बाजू के कपड़े पहनें।",
    fallback: "कृपया **लक्षण**, **उपचार**, या **बचाव** के बारे में पूछें।"
  },
  kn: {
    about: "# ಮಲೇರಿಯಾ ಬಗ್ಗೆ\nಮಲೇರಿಯಾವು *ಪ್ಲಾಸ್ಮೋಡಿಯಂ* ಪರಾವಲಂಬಿಗಳಿಂದ ಉಂಟಾಗುವ ಮತ್ತು ಸೊಳ್ಳೆಗಳ ಮೂಲಕ ಹರಡುವ ಕಾಯಿಲೆಯಾಗಿದೆ.",
    symptoms: "# ಲಕ್ಷಣಗಳು\n• ತೀವ್ರ ಜ್ವರ\n• ಚಳಿ ಮತ್ತು ನಡುಕ\n• ಬೆವರುವಿಕೆ\n• ತಲೆನೋವು",
    treatment: "# ಚಿಕಿತ್ಸೆ (WHO)\n• ಫಾಲ್ಸಿಪಾರಮ್: ACT ಚಿಕಿತ್ಸೆ.\n• ವೈವಾಕ್ಸ್: ಕ್ಲೋರೊಕ್ವಿನ್ + ಪ್ರೈಮಾಕ್ವಿನ್.",
    prevention: "# ತಡೆಗಟ್ಟುವಿಕೆ\n• ಸೊಳ್ಳೆ ಪರದೆಗಳನ್ನು ಬಳಸಿ.\n• ಪೂರ್ಣ ತೋಳಿನ ಬಟ್ಟೆ ಧರಿಸಿ.",
    fallback: "ದಯವಿಟ್ಟು **ಲಕ್ಷಣಗಳು** ಅಥವಾ **ಚಿಕಿತ್ಸೆ** ಬಗ್ಗೆ ಕೇಳಿ."
  },
  te: {
    about: "# మలేరియా గురించి\nమలేరియా అనేది పరాన్నజీవుల వల్ల వచ్చే మరియు దోమల ద్వారా వ్యాపించే వ్యాధి.",
    symptoms: "# లక్షణాలు\n• జ్వరం, చలి, చెమట పట్టడం, తలనొప్పి.",
    treatment: "# చికిత్స (WHO)\n• ఫాల్సిపారమ్: ACT థెరపీ; వైవాక్స్: క్లోరోక్విన్.",
    prevention: "# నివారణ\n• దోమతెరలు వాడండి; ఫుల్ చేతుల దుస్తులు ధరించండి.",
    fallback: "**లక్షణాలు** లేదా **చికిత్స** గురించి అడగండి."
  },
  ta: {
    about: "# மலேரியா பற்றி\nமலேரியா என்பது ஒட்டுண்ணிகளால் ஏற்படும் மற்றும் கொசுக்கள் மூலம் பரவும் ஒரு நோயாகும்.",
    symptoms: "# அறிகுறிகள்\n• காய்ச்சல், குளிர், வியர்த்தல், தலைவலி.",
    treatment: "# சிகிச்சை (WHO)\n• பால்சிபாரம்: ACT சிகிச்சை; வைவாக்ஸ்: குளோரோகுயின்.",
    prevention: "# தடுப்பு முறைகள்\n• கொசுவலைகளை பயன்படுத்துங்கள்.",
    fallback: "**அறிகுறிகள்** அல்லது **சிகிச்சை** பற்றி கேட்கவும்."
  },
  ml: {
    about: "# മലേറിയയെക്കുറിച്ച്\nകൊതുകുകൾ പരത്തുന്ന പരാദങ്ങൾ മൂലമുണ്ടാകുന്ന രോഗമാണ് മലേറിയ.",
    symptoms: "# ലക്ഷണങ്ങൾ\n• ശക്തമായ പനി, വിറയൽ, തലവേദന.",
    treatment: "# ചികിത്സ (WHO)\n• ഫാൽസിപാരം: ACT ചികിത്സ; വൈവാക്സ്: ക്ലോറോക്വിൻ.",
    prevention: "# പ്രതിരോധം\n• കൊതുകുവലകൾ ഉപയോഗിക്കുക.",
    fallback: "**ലക്ഷണങ്ങൾ** അല്ലെങ്കിൽ **ചികിത്സ** എന്നിവയെക്കുറിച്ച് ചോദിക്കുക."
  },
  mr: {
    about: "# मलेरियाबद्दल\nमलेरिया हा डासांमुळे होणारा आजार आहे जो परजीवीमुळे होतो।",
    symptoms: "# लक्षणे\n• ताप, थंडी वाजणे, घाम येणे, अंगदुखी।",
    treatment: "# उपचार (WHO)\n• फाल्सीपेरम: ACT; वाइवैक्स: क्लोरोक्वीन।",
    prevention: "# प्रतिबंध\n• मच्छरदानी वापरा; पूर्ण बाह्यांचे कपडे घाला।",
    fallback: "**लक्षणे** किंवा **उपचार** बद्दल विचारा।"
  },
  bn: {
    about: "# ম্যালেরিয়া সম্পর্কে\nম্যালেরিয়া হল মশার মাধ্যমে ছড়ানো একটি রোগ যা পরজীবীর কারণে হয়।",
    symptoms: "# লক্ষণ\n• তীব্র জ্বর, কাঁপুনি দিয়ে ঠান্ডা লাগা, ঘাম হওয়া।",
    treatment: "# চিকিৎসা (WHO)\n• ফ্যালসিপেরাম: ACT; ভাইভ্যাক্স: ক্লোরোকুইন।",
    prevention: "# প্রতিরোধ\n• মশারি ব্যবহার করুন।",
    fallback: "**লক্ষণ** বা **চিকিৎসা** সম্পর্কে জিজ্ঞাসা করুন।"
  },
  fr: {
    about: "# Le Paludisme\nMaladie causée par des parasites transmis par les moustiques.",
    symptoms: "# Symptômes\n• Fièvre, frissons, sueurs, maux de tête.",
    treatment: "# Traitement\n• Falciparum: ACT; Vivax: Chloroquine.",
    prevention: "# Prévention\n• Moustiquaires et répulsifs.",
    fallback: "Essayez les **Symptômes** ou le **Traitement**."
  },
  es: {
    about: "# La Malaria\nEnfermedad causada por parásitos transmitidos por mosquitos.",
    symptoms: "# Síntomas\n• Fiebre, escalofríos, sudoración.",
    treatment: "# Tratamiento\n• Falciparum: ACT; Vivax: Cloroquina.",
    prevention: "# Prevención\n• Mosquiteros y repelentes.",
    fallback: "Intente con **Síntomas** o **Tratamiento**."
  },
  ar: {
    about: "# عن الملاريا\nمرض تسببه طفيليات وينتقل عبر البعوض.",
    symptoms: "# الأعراض\n• حمى شديدة، قشعريرة، تعرق، صداع.",
    treatment: "# العلاج\n• فالسبارم: ACT؛ فايفاكس: كلوروكين.",
    prevention: "# الوقاية\n• الناموسيات والرش المنزلي.",
    fallback: "حاول السؤال عن **الأعراض** أو **العلاج**."
  }
};

const detectLanguage = (text) => {
  const t = text.toLowerCase();
  if (/[\u0900-\u097F]/.test(t)) return 'hi'; 
  if (/[\u0C80-\u0CFF]/.test(t)) return 'kn'; 
  if (/[\u0C00-\u0C7F]/.test(t)) return 'te'; 
  if (/[\u0B80-\u0BFF]/.test(t)) return 'ta'; 
  if (/[\u0D00-\u0D7F]/.test(t)) return 'ml'; 
  if (/[\u0980-\u09FF]/.test(t)) return 'bn'; 
  if (/[\u0600-\u06FF]/.test(t)) return 'ar'; 
  
  // Specific keywords for Western languages
  const frKeys = ['paludisme', 'symptômes', 'traitement', 'comment', 'prévention'];
  const esKeys = ['malaria', 'síntomas', 'tratamiento', 'como', 'prevención'];
  if (frKeys.some(k => t.includes(k))) return 'fr';
  if (esKeys.some(k => t.includes(k))) return 'es';
  
  return null;
};

const findResponse = (query, appLang = 'en') => {
  const q = query.toLowerCase().trim();
  const detectedLang = detectLanguage(q) || appLang;
  const langPack = LOCALIZED_RESPONSES[detectedLang] || LOCALIZED_RESPONSES.en;
  
  const intents = {
    about: ['malaria', 'what', 'species', 'मलेरिया', 'ಮಲೇರಿಯಾ', 'మలేరియా', 'மலேரியா', 'മലേറിയ', 'ম্যালেরিয়া', 'paludisme'],
    symptoms: ['symptom', 'fever', 'chills', 'headache', 'लक्षण', 'बुखार', 'ಲಕ್ಷಣಗಳು', 'ಜ್ವರ', 'లక్షణాలు', 'అறிகுறிகள்', 'ലക്ഷണങ്ങൾ', ' ताप'],
    treatment: ['treat', 'medicine', 'drug', 'dose', 'cure', 'उपचार', 'दवाई', 'ಚಿಕಿತ್ಸೆ', 'చికిత్స', 'சிகிச்சை', 'ചികിത്സ'],
    prevention: ['prevent', 'protect', 'net', 'mosquito', 'बचाव', 'ತಡೆಗಟ್ಟುವಿಕೆ', 'నివారణ', 'தடுப்பு', 'പ്രതിരോധം']
  };

  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(k => q.includes(k))) return langPack[intent];
  }

  // Greetings
  if (['hi', 'hello', 'नमस्ते', 'ಹಲೋ', 'హలో', 'வணக்கம்', 'ഹലോ', 'مرحباً', 'bonjour', 'hola'].some(k => q.includes(k))) {
    const greetings = {
      en: "👋 Hello! I am **Dr. MalariaAI**. Ask me anything about symptoms or treatment.",
      hi: "👋 नमस्ते! मैं **Dr. MalariaAI** हूँ। लक्षणों या उपचार के बारे में पूछें।",
      kn: "👋 ನಮಸ್ಕಾರ! ನಾನು **Dr. MalariaAI**. ಲಕ್ಷಣಗಳು ಅಥವಾ ಚಿಕಿತ್ಸೆಯ ಬಗ್ಗೆ ಕೇಳಿ.",
      te: "👋 నమస్కారం! నేను **Dr. MalariaAI**. లక్షణాలు లేదా చికిత్స గురించి అడగండి.",
      ta: "👋 வணக்கம்! நான் **Dr. MalariaAI**. அறிகுறிகள் அல்லது சிகிச்சை பற்றி கேட்கவும்.",
      ml: "👋 നമസ്കാരം! ഞാൻ **Dr. MalariaAI**. ലക്ഷണങ്ങളെക്കുറിച്ചോ ചികിത്സയെക്കുറിച്ചോ ചോദിക്കുക.",
      mr: "👋 नमस्कार! मी **Dr. MalariaAI** आहे. लक्षणे किंवा उपचारांबद्दल विचारा।",
      bn: "👋 নমস্কার! আমি **Dr. MalariaAI**। লক্ষণ বা চিকিৎসা সম্পর্কে জিজ্ঞাসা করুন।",
      fr: "👋 Bonjour! Je suis **Dr. MalariaAI**. Posez-moi des questions sur les symptômes.",
      es: "👋 ¡Hola! Soy **Dr. MalariaAI**. Pregúntame sobre síntomas o tratamiento.",
      ar: "👋 مرحباً! أنا **د. مالارياAI**. اسألني عن الأعراض أو العلاج."
    };
    return greetings[detectedLang] || greetings.en;
  }

  return langPack.fallback;
};

const renderMessage = (text) => {
  if (!text || typeof text !== 'string') return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    if (line.startsWith('# ')) return <h4 key={i} className="chat-header-main">{line.slice(2)}</h4>;
    if (line.startsWith('### ')) return <h5 key={i} className="chat-header-sub">{line.slice(4)}</h5>;
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part
    );
    if (line.trim().startsWith('•')) return <p key={i} className="chat-bullet">{parts}</p>;
    if (line.trim().startsWith('🚨')) return <p key={i} className="chat-bullet critical">{parts}</p>;
    if (line.trim().startsWith('⚠️')) return <p key={i} className="chat-bullet warning">{parts}</p>;
    if (line.startsWith('---')) return <hr key={i} className="chat-divider" />;
    return <p key={i} className="chat-line">{parts}</p>;
  });
};

export default function Chatbot({ lang = 'en' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setMessages([{ role: 'bot', text: "👋 Hello! I'm **Dr. MalariaAI**. I can assist in 11 languages. Speak to me naturally! 😊" }]);
  }, []);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [messages, open]);

  const send = async (text) => {
    const q = text || input.trim();
    if (!q) return;
    
    const userLang = detectLanguage(q) || lang;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setTyping(true);
    
    try {
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, lang: userLang })
      });
      
      const data = await response.json();
      const botText = data.response || data.detail || "I'm sorry, I encountered an error processing that.";
      setMessages(prev => [...prev, { role: 'bot', text: botText }]);
    } catch (error) {
      console.error("Chat error:", error);
      // Fallback to local response if backend is down
      const fallbackText = findResponse(q, lang) || "Service temporarily unavailable.";
      setMessages(prev => [...prev, { role: 'bot', text: fallbackText }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      <div className={`chatbot-fab-container ${open ? 'active' : ''}`}>
        <button className={`chatbot-fab ${open ? 'fab-active' : 'chatbot-bounce'}`} onClick={() => setOpen(o => !o)}>
          <div className="fab-icon-container">
            {open ? <i className="ph ph-x"></i> : <i className="ph ph-stethoscope"></i>}
          </div>
          {!open && <span className="fab-label-text">Clinical AI</span>}
        </button>
      </div>
      {open && (
        <div className="chatbot-panel glass-card chatbot-animate-in">
          <div className="chatbot-header">
            <div className="doctor-profile">
              <div className="avatar-wrapper"><i className="ph ph-user-circle"></i><span className="online-indicator"></span></div>
              <div className="profile-info">
                <h4>Dr. MalariaAI <i className="ph ph-seal-check-fill verified-badge"></i></h4>
                <div className="status-label"><i className="ph ph-sparkle"></i><span>Gemini-Powered Clinical AI</span></div>
              </div>
            </div>
            <button className="chatbot-close-btn" onClick={() => setOpen(false)}><i className="ph ph-caret-down"></i></button>
          </div>
          <div className="chatbot-messages-container">
            <div className="messages-scroller">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-msg-row ${msg.role}`}>
                  {msg.role === 'bot' && <div className="bot-avatar-mini"><i className="ph ph-brain"></i></div>}
                  <div className={`chat-bubble-new ${msg.role} glass-card`}>{renderMessage(msg.text)}</div>
                </div>
              ))}
              {typing && (
                <div className="chat-msg-row bot">
                  <div className="bot-avatar-mini"><i className="ph ph-brain"></i></div>
                  <div className="chat-bubble-new typing-bubble glass-card"><div className="dot-pulse"><span></span><span></span><span></span></div></div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="chatbot-footer-new">
            <div className="input-container-new">
              <input ref={inputRef} type="text" placeholder="Ask Gemini anything..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
              <button className="send-action-btn" onClick={() => send()} disabled={!input.trim()}><i className="ph ph-paper-plane-right-fill"></i></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
