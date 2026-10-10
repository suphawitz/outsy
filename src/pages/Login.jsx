import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../client';

export default function Login() {
  const navigate = useNavigate();

  /* =========================
     THEME
  ========================= */

  const theme = {
    red: '#d71920',
    redDark: '#bd151b',

    yellow: '#f4c400',
    pastelYellow: '#fff1b8',

    cyan: '#25b8bd',
    pastelMint: '#dff5f2',

    pastelPink: '#ffe8e8',
    pastelCream: '#fff8ee',
    pastelBlue: '#eaf6fa',
    pastelPurple: '#f1ecfa',

    brown: '#4b362f',

    card: '#fffdf9',

    border: '#e8dfd2',

    textMain: '#3d3936',
    textMuted: '#7b7772',
  };

  /* =========================
     STATE
  ========================= */

  const [mode, setMode] = useState('signin');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  /* =========================
     TOAST
  ========================= */

  const triggerToast = (msg) => {
    setToastMsg(msg);

    setTimeout(() => {
      setToastMsg('');
    }, 3500);
  };

  /* =========================
     FORM SUBMIT
  ========================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setErrorMsg('');
    setLoading(true);

    try {
      /* =========================
         FORGOT PASSWORD
      ========================= */

      if (mode === 'forgot') {
        const { error } =
          await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
              redirectTo:
                `${window.location.origin}/update-password`,
            }
          );

        if (error) throw error;

        triggerToast(
          'ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว'
        );

        setMode('signin');

      /* =========================
         SIGN UP
      ========================= */

      } else if (mode === 'signup') {
        const {
          data,
          error: signUpError,
        } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,

          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        triggerToast(
          `ยินดีต้อนรับคุณ ${
            fullName || email
          }!`
        );

        if (data?.session) {
          setTimeout(() => {
            navigate('/packages');
          }, 1200);
        } else {
          setErrorMsg(
            'สมัครสมาชิกเรียบร้อยแล้ว กรุณาตรวจสอบอีเมลยืนยันตัวตน'
          );
        }

      /* =========================
         SIGN IN
      ========================= */

      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password,
          });

        if (error) {
          throw error;
        }

        triggerToast(
          'เข้าสู่ระบบสำเร็จแล้ว!'
        );

        setTimeout(() => {
          navigate('/packages');
        }, 800);
      }

    } catch (err) {
      setErrorMsg(
        err.message ||
          'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     CHANGE MODE
  ========================= */

  const changeMode = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
  };

  /* =========================
     RENDER
  ========================= */

  return (
    <div
      className="login-page-wrapper"
      style={{
        minHeight: '100vh',

        /* =========================
           BACKGROUND
        ========================= */

        backgroundImage:
          'url("/logologinfull.png")',

        backgroundSize: 'cover',

        backgroundPosition: 'center center',

        backgroundRepeat: 'no-repeat',

        /* =========================
           LAYOUT
        ========================= */

        display: 'flex',

        flexDirection: 'row',

        justifyContent: 'flex-end',

        alignItems: 'center',

        /* 
          ขยับ Card ออกจากขอบขวา
          ประมาณ 1 นิ้ว
        */

        padding:
          '40px 96px 40px 5vw',

        fontFamily:
          "'Prompt', -apple-system, BlinkMacSystemFont, sans-serif",

        boxSizing: 'border-box',

        position: 'relative',

        overflow: 'hidden',
      }}
    >

      {/* =========================
          BACKGROUND OVERLAY
          ไม่ใช้ Blur
      ========================= */}

      <div
        style={{
          position: 'absolute',

          inset: 0,

          background:
            'linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.28) 45%, rgba(255,255,255,0.56) 100%)',

          zIndex: 1,

          pointerEvents: 'none',
        }}
      />

      {/* =========================
          SOFT PASTEL LIGHT
      ========================= */}

      <div
        style={{
          position: 'absolute',

          width: '420px',

          height: '420px',

          borderRadius: '50%',

          background:
            'rgba(255, 235, 194, 0.18)',

          top: '-140px',

          left: '-120px',

          filter: 'blur(10px)',

          zIndex: 1,

          pointerEvents: 'none',
        }}
      />

      {/* =========================
          LOGIN CARD
      ========================= */}

      <div
        className="login-page-card"
        style={{
          width: '100%',

          maxWidth: '500px',

          /* 
            ขยับจากขอบขวามาทางซ้าย
            ประมาณ 1 นิ้ว
          */

          marginLeft: 'auto',

          marginRight: '0',

          /* =========================
             PASTEL CARD
          ========================= */

          background:
            'linear-gradient(135deg, #fffdf9 0%, #ffffff 48%, #fff0f0 100%)',

          borderRadius: '28px',

          border:
            '1px solid rgba(255,255,255,0.95)',

          boxShadow:
            '0 22px 60px rgba(76, 62, 52, 0.20)',

          padding:
            '44px 42px',

          position: 'relative',

          zIndex: 10,

          boxSizing: 'border-box',
        }}
      >

        {/* =========================
            DECORATIVE PASTEL CIRCLE
        ========================= */}

        <div
          style={{
            position: 'absolute',

            width: '80px',

            height: '80px',

            borderRadius: '50%',

            background:
              'rgba(255, 224, 224, 0.45)',

            top: '-25px',

            right: '-20px',

            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'absolute',

            width: '50px',

            height: '50px',

            borderRadius: '50%',

            background:
              'rgba(219, 244, 240, 0.55)',

            bottom: '90px',

            left: '-25px',

            pointerEvents: 'none',
          }}
        />

        {/* =========================
            HEADER
        ========================= */}

        <div
          style={{
            textAlign: 'center',

            marginBottom: '26px',

            position: 'relative',

            zIndex: 2,
          }}
        >

          <Link
            to="/"
            style={{
              textDecoration: 'none',

              display: 'inline-flex',

              alignItems: 'center',

              gap: '8px',

              marginBottom: '10px',
            }}
          >

            <span
              style={{
                background:
                  'linear-gradient(135deg, #ffe486, #f4c400)',

                color: theme.brown,

                padding: '6px 17px',

                borderRadius: '10px',

                fontSize: '14px',

                fontWeight: '900',

                letterSpacing: '0.3px',

                boxShadow:
                  '0 4px 12px rgba(244,196,0,0.20)',
              }}
            >
              WELCOME!
            </span>

          </Link>

          <h2
            style={{
              fontSize: '27px',

              fontWeight: '800',

              color: theme.brown,

              margin:
                '0 0 7px 0',

              letterSpacing:
                '-0.4px',
            }}
          >
            {mode === 'forgot'
              ? 'รีเซ็ตรหัสผ่าน'
              : mode === 'signup'
              ? 'สมัครสมาชิก OUTSY!'
              : 'เข้าสู่ระบบ OUTSY!'}
          </h2>

          <p
            style={{
              margin: 0,

              fontSize: '13px',

              color:
                theme.textMuted,

              lineHeight: '1.7',
            }}
          >
            {mode === 'forgot'
              ? 'กรอกอีเมลเพื่อรับลิงก์สำหรับตั้งค่ารหัสผ่านใหม่'
              : mode === 'signup'
              ? 'เริ่มต้นวางแผนทริปสายมู One-Day Trip กับเรา'
              : 'ยินดีต้อนรับกลับมา! ออกเดินทางไปกับ OUTSY!'}
          </p>

        </div>

        {/* =========================
            TAB
        ========================= */}

        {mode !== 'forgot' && (
          <div
            style={{
              display: 'grid',

              gridTemplateColumns:
                '1fr 1fr',

              background:
                'linear-gradient(90deg, #fffbec, #fdeaea)',

              padding: '5px',

              borderRadius: '14px',

              marginBottom: '24px',

              gap: '5px',

              position: 'relative',

              zIndex: 2,
            }}
          >

            {/* SIGN IN TAB */}

            <button
              type="button"

              onClick={() =>
                changeMode('signin')
              }

              style={{
                padding:
                  '11px 12px',

                borderRadius:
                  '10px',

                border: 'none',

                background:
                  mode === 'signin'
                    ? '#fff1a8'
                    : 'transparent',

                color:
                  mode === 'signin'
                    ? theme.brown
                    : '#7b7772',

                fontWeight:
                  mode === 'signin'
                    ? '800'
                    : '600',

                fontSize: '13px',

                cursor: 'pointer',

                boxShadow:
                  mode === 'signin'
                    ? '0 3px 10px rgba(218,181,75,0.18)'
                    : 'none',

                transition:
                  'all 0.2s ease',
              }}
            >
              🔑 เข้าสู่ระบบ
            </button>

            {/* SIGN UP TAB */}

            <button
              type="button"

              onClick={() =>
                changeMode('signup')
              }

              style={{
                padding:
                  '11px 12px',

                borderRadius:
                  '10px',

                border: 'none',

                background:
                  mode === 'signup'
                    ? '#dff5f2'
                    : 'transparent',

                color:
                  mode === 'signup'
                    ? '#28706f'
                    : '#7b7772',

                fontWeight:
                  mode === 'signup'
                    ? '800'
                    : '600',

                fontSize: '13px',

                cursor: 'pointer',

                boxShadow:
                  mode === 'signup'
                    ? '0 3px 10px rgba(37,184,189,0.16)'
                    : 'none',

                transition:
                  'all 0.2s ease',
              }}
            >
              ✨ สมัครสมาชิก
            </button>

          </div>
        )}

        {/* =========================
            ERROR MESSAGE
        ========================= */}

        {errorMsg && (
          <div
            style={{
              background:
                '#fff1f1',

              border:
                '1px solid #f1bfc1',

              borderRadius:
                '11px',

              padding:
                '11px 13px',

              color:
                theme.red,

              fontSize:
                '12px',

              fontWeight:
                '600',

              marginBottom:
                '18px',

              display: 'flex',

              alignItems:
                'center',

              gap: '7px',

              position:
                'relative',

              zIndex: 2,
            }}
          >
            <span>⚠️</span>

            <span>
              {errorMsg}
            </span>
          </div>
        )}

        {/* =========================
            FORM
        ========================= */}

        <form
          onSubmit={handleSubmit}

          style={{
            display: 'flex',

            flexDirection:
              'column',

            gap: '17px',

            position:
              'relative',

            zIndex: 2,
          }}
        >

          {/* =========================
              FULL NAME
          ========================= */}

          {mode === 'signup' && (
            <div>
              <label
                style={labelStyle}
              >
                ชื่อ - นามสกุล
              </label>

              <div
                style={{
                  ...inputContainerStyle,

                  background:
                    '#fffefe',
                }}
              >

                <span
                  style={{
                    marginRight:
                      '10px',

                    fontSize:
                      '15px',
                  }}
                >
                  👤
                </span>

                <input
                  type="text"

                  required

                  placeholder=
                    "กรอกชื่อและนามสกุลจริง"

                  value={fullName}

                  onChange={(e) =>
                    setFullName(
                      e.target.value
                    )
                  }

                  style={
                    innerInputStyle
                  }
                />

              </div>
            </div>
          )}

          {/* =========================
              EMAIL
          ========================= */}

          <div>

            <label
              style={labelStyle}
            >
              อีเมล (Email Address)
            </label>

            <div
              style={
                inputContainerStyle
              }
            >

              <span
                style={{
                  marginRight:
                    '10px',

                  fontSize:
                    '15px',
                }}
              >
                ✉️
              </span>

              <input
                type="email"

                required

                placeholder=
                  "yourname@example.com"

                value={email}

                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }

                style={
                  innerInputStyle
                }
              />

            </div>

          </div>

          {/* =========================
              PASSWORD
          ========================= */}

          {mode !== 'forgot' && (
            <div>

              <label
                style={labelStyle}
              >
                รหัสผ่าน (Password)
              </label>

              <div
                style={
                  inputContainerStyle
                }
              >

                <span
                  style={{
                    marginRight:
                      '10px',

                    fontSize:
                      '15px',
                  }}
                >
                  🔒
                </span>

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }

                  required

                  placeholder=
                    "ความยาวอย่างน้อย 6 ตัวอักษร"

                  value={password}

                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }

                  style={
                    innerInputStyle
                  }
                />

                <button
                  type="button"

                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }

                  style={{
                    background:
                      'none',

                    border:
                      'none',

                    cursor:
                      'pointer',

                    padding: 0,

                    fontSize:
                      '15px',

                    color:
                      theme.textMuted,
                  }}
                >
                  {showPassword
                    ? '👁️'
                    : '👁️‍🗨️'}
                </button>

              </div>

            </div>
          )}

          {/* =========================
              REMEMBER + FORGOT
          ========================= */}

          {mode === 'signin' && (
            <div
              style={{
                display: 'flex',

                justifyContent:
                  'space-between',

                alignItems:
                  'center',

                fontSize:
                  '12px',

                marginTop:
                  '-2px',
              }}
            >

              <label
                style={{
                  display: 'flex',

                  alignItems:
                    'center',

                  gap: '6px',

                  cursor:
                    'pointer',

                  color:
                    theme.textMuted,
                }}
              >

                <input
                  type="checkbox"

                  checked={
                    rememberMe
                  }

                  onChange={(e) =>
                    setRememberMe(
                      e.target.checked
                    )
                  }

                  style={{
                    accentColor:
                      theme.red,

                    cursor:
                      'pointer',
                  }}
                />

                จดจำการเข้าสู่ระบบ

              </label>

              <button
                type="button"

                onClick={() => {
                  setMode('forgot');
                  setErrorMsg('');
                }}

                style={{
                  background:
                    'none',

                  border:
                    'none',

                  color:
                    '#1677a8',

                  cursor:
                    'pointer',

                  padding: 0,

                  fontWeight:
                    '600',
                }}
              >
                ลืมรหัสผ่าน?
              </button>

            </div>
          )}

          {/* =========================
              SUBMIT BUTTON
          ========================= */}

          <button
            type="submit"

            disabled={loading}

            style={{
              background:
                'linear-gradient(135deg, #e31b23 0%, #d71920 100%)',

              color:
                '#ffffff',

              border:
                'none',

              padding:
                '14px',

              borderRadius:
                '11px',

              fontSize:
                '14px',

              fontWeight:
                '700',

              cursor:
                loading
                  ? 'not-allowed'
                  : 'pointer',

              boxShadow:
                '0 8px 20px rgba(215,25,32,0.22)',

              transition:
                'all 0.15s ease',

              marginTop:
                '3px',

              opacity:
                loading
                  ? 0.75
                  : 1,
            }}

            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background =
                  'linear-gradient(135deg, #cf171e 0%, #bd151b 100%)';

                e.currentTarget.style.transform =
                  'translateY(-1px)';
              }
            }}

            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                'linear-gradient(135deg, #e31b23 0%, #d71920 100%)';

              e.currentTarget.style.transform =
                'translateY(0)';
            }}
          >
            {loading
              ? 'กำลังดำเนินการ...'
              : mode === 'forgot'
              ? 'ส่งลิงก์ตั้งรหัสผ่านใหม่ ➔'
              : mode === 'signup'
              ? 'สร้างบัญชีสมาชิก ➔'
              : 'เข้าสู่ระบบ ➔'}
          </button>

        </form>

        {/* =========================
            BACK TO LOGIN
        ========================= */}

        {mode === 'forgot' && (
          <div
            style={{
              textAlign:
                'center',

              marginTop:
                '17px',

              position:
                'relative',

              zIndex: 2,
            }}
          >

            <button
              type="button"

              onClick={() => {
                setMode('signin');
                setErrorMsg('');
              }}

              style={{
                background:
                  'none',

                border:
                  'none',

                color:
                  theme.red,

                fontWeight:
                  '600',

                fontSize:
                  '12px',

                cursor:
                  'pointer',

                textDecoration:
                  'underline',
              }}
            >
              ← ย้อนกลับไปหน้าเข้าสู่ระบบ
            </button>

          </div>
        )}

        {/* =========================
            SERVICE INFORMATION
        ========================= */}

        <div
          style={{
            marginTop:
              '24px',

            paddingTop:
              '15px',

            borderTop:
              '1px solid #eadfd5',

            display:
              'flex',

            justifyContent:
              'center',

            alignItems:
              'center',

            flexWrap:
              'wrap',

            gap:
              '10px',

            fontSize:
              '10px',

            color:
              theme.textMuted,

            position:
              'relative',

            zIndex:
              2,
          }}
        >

          <span>
            🚐 รถตู้ VIP
          </span>

          <span>
            •
          </span>

          <span>
            🛕 วางแผนฤกษ์มงคล
          </span>

          <span>
            •
          </span>

          <span>
            🛡️ การันตีราคา
          </span>

        </div>

      </div>

      {/* =========================
          TOAST
      ========================= */}

      {toastMsg && (
        <div
          style={{
            position:
              'fixed',

            bottom:
              '24px',

            right:
              '24px',

            background:
              'linear-gradient(135deg, #3d3936, #514943)',

            color:
              '#ffffff',

            padding:
              '13px 20px',

            borderRadius:
              '12px',

            boxShadow:
              '0 10px 25px rgba(0,0,0,0.16)',

            zIndex:
              9999,

            display:
              'flex',

            alignItems:
              'center',

            gap:
              '8px',

            fontSize:
              '13px',

            fontWeight:
              '500',
          }}
        >

          <span
            style={{
              color:
                '#8ee5b1',
            }}
          >
            ✓
          </span>

          <span>
            {toastMsg}
          </span>

        </div>
      )}

      {/* =========================
          RESPONSIVE STYLE
      ========================= */}

      <style>
        {`
          @media (max-width: 900px) {
            .login-page-card {
              margin-right: 0 !important;
            }
          }

          @media (max-width: 700px) {
            .login-page-wrapper {
              padding: 25px 20px !important;
              justify-content: center !important;
            }

            .login-page-card {
              max-width: 100% !important;
              padding: 34px 25px !important;
              border-radius: 22px !important;
            }
          }

          @media (max-width: 480px) {
            .login-page-wrapper {
              padding: 18px 12px !important;
            }

            .login-page-card {
              padding: 30px 20px !important;
            }
          }
        `}
      </style>

    </div>
  );
}


/* =====================================================
   LABEL STYLE
===================================================== */

const labelStyle = {
  display: 'block',

  fontSize: '12px',

  fontWeight: '700',

  color: '#514b46',

  marginBottom: '6px',
};


/* =====================================================
   INPUT CONTAINER
===================================================== */

const inputContainerStyle = {
  display: 'flex',

  alignItems: 'center',

  background:
    'rgba(255, 255, 255, 0.90)',

  border:
    '1px solid #e3d9cf',

  borderRadius:
    '11px',

  padding:
    '11px 14px',

  transition:
    'all 0.2s ease',

  minHeight:
    '48px',

  boxSizing:
    'border-box',

  boxShadow:
    'inset 0 1px 2px rgba(100,80,60,0.03)',
};


/* =====================================================
   INPUT
===================================================== */

const innerInputStyle = {
  flex: 1,

  border:
    'none',

  outline:
    'none',

  background:
    'transparent',

  fontSize:
    '13px',

  color:
    '#2f2b28',

  minWidth:
    0,

  fontFamily:
    "'Prompt', -apple-system, BlinkMacSystemFont, sans-serif",
};