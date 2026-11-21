import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/apiClient';

type Role = 'student' | 'faculty';

export default function LoginScreen() {
  const [isSignup, setIsSignup] = useState(false);

  // Admin is NOT shown or selectable on the frontend.
  // Backend determines the user's actual role from credentials.
  const [selectedRole, setSelectedRole] =
    useState<Role>('student');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugMessage, setDebugMessage] = useState('');

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const handleAuthAction = async () => {
    const cleanEmail = email.trim();

    // ----------------------------------------
    // BASIC VALIDATION
    // ----------------------------------------

    if (
      (isSignup && !name.trim()) ||
      !cleanEmail ||
      !password.trim()
    ) {
      setDebugMessage(
        'Error: Please fill in all required fields.'
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      setDebugMessage(
        'Please enter a valid email address.'
      );
      return;
    }

    // ----------------------------------------
    // SIGNUP VALIDATION
    // ----------------------------------------

    if (isSignup) {
      if (
        name.trim().length < 2 ||
        name.trim().length > 100
      ) {
        setDebugMessage(
          'Name must contain between 2 and 100 characters.'
        );
        return;
      }

      // Public registration is only for students.
      if (selectedRole !== 'student') {
        setDebugMessage(
          'Only students can create an account. Faculty accounts are created by an administrator.'
        );
        setSelectedRole('student');
        return;
      }

      // Strong password validation.
      if (
        password.length < 12 ||
        password.length > 128 ||
        !/[a-z]/.test(password) ||
        !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password) ||
        !/[^A-Za-z0-9]/.test(password)
      ) {
        setDebugMessage(
          'Password must be 12–128 characters and include lowercase, uppercase, a number, and a special character.'
        );
        return;
      }
    }

    setLoading(true);
    setDebugMessage('Connecting to server...');

    try {
      let response;

      // ========================================
      // LOGIN
      // ========================================

      if (!isSignup) {
        /*
         * IMPORTANT:
         *
         * Do NOT send a role during login.
         *
         * The backend determines whether the
         * credentials belong to:
         *
         * Student
         * Faculty
         * Admin
         *
         * Therefore Admin does not need a button,
         * tab, or selector on this screen.
         */

        response = await API.post('/auth/login', {
          email: cleanEmail,
          password,
        });
      }

      // ========================================
      // STUDENT REGISTRATION
      // ========================================

      else {
        /*
         * Public registration is ONLY for students.
         *
         * Faculty accounts are created by Admin.
         * Admin accounts are managed separately.
         */

        response = await API.post('/auth/register', {
          name: name.trim(),
          email: cleanEmail,
          password,
          role: 'student',
        });
      }

      // ========================================
      // NORMALIZE RESPONSE
      // ========================================

      const responseBody = response?.data || {};

      const data =
        responseBody?.data ||
        responseBody ||
        {};

      const token = data?.token;
      const user = data?.user;

      // ========================================
      // VERIFY RESPONSE
      // ========================================

      if (!user) {
        throw new Error(
          'User information was not returned by the server.'
        );
      }

      // ========================================
      // SAVE TOKEN
      // ========================================

      if (token) {
        await AsyncStorage.setItem(
          'token',
          token
        );

        // Web support
        if (Platform.OS === 'web') {
          localStorage.setItem(
            'token',
            token
          );
        }
      }

      // ========================================
      // SAVE USER
      // ========================================

      await AsyncStorage.setItem(
        'userData',
        JSON.stringify(user)
      );

      // ========================================
      // SIGNUP SUCCESS
      // ========================================

      if (isSignup) {
        setDebugMessage(
          'Account created successfully. Please sign in.'
        );

        Alert.alert(
          'Registration Successful',
          'Your student account has been created. Please sign in.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsSignup(false);
                setPassword('');
                setDebugMessage('');
              },
            },
          ]
        );

        return;
      }

      // ========================================
      // LOGIN SUCCESS
      // ========================================

      setDebugMessage(
        'Login successful. Redirecting...'
      );

      // ========================================
      // TEMPORARY PASSWORD
      // ========================================

      if (user.mustChangePassword === true) {
        router.replace(
          '/change-password' as any
        );
        return;
      }

      // ========================================
      // ADMIN
      // ========================================

      /*
       * Admin is completely hidden from the UI.
       *
       * If the backend returns role = admin,
       * the user is automatically redirected
       * to the Admin Dashboard.
       */

      if (user.role === 'admin') {
        router.replace(
          '/admin-dashboard' as any
        );
        return;
      }

      // ========================================
      // FACULTY
      // ========================================

      if (user.role === 'faculty') {
        router.replace(
          '/faculty-dashboard' as any
        );
        return;
      }

      // ========================================
      // STUDENT
      // ========================================

      if (user.role === 'student') {
        router.replace(
          '/student-dashboard' as any
        );
        return;
      }

      // ========================================
      // INVALID ROLE
      // ========================================

      Alert.alert(
        'Login Error',
        'Your account has an invalid role. Please contact the administrator.'
      );

    } catch (err: any) {
      console.log(
        'Authentication error:',
        err?.response?.data || err
      );

      const validationErrors =
        err?.response?.data?.errors;

      const details =
        Array.isArray(validationErrors)
          ? validationErrors
              .map(
                ({
                  field,
                  message,
                }: {
                  field: string;
                  message: string;
                }) =>
                  `${field}: ${message}`
              )
              .join('\n')
          : '';

      const message = [
        err?.response?.data?.message,
        details,
        err?.message,
      ]
        .filter(Boolean)
        .join('\n');

      setDebugMessage(
        `Authentication failed: ${
          message ||
          'Could not connect to the backend.'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LOGIN MODE
  // ==========================================

  const handleLoginMode = () => {
    setIsSignup(false);
    setName('');
    setPassword('');
    setDebugMessage('');
  };

  // ==========================================
  // SIGNUP MODE
  // ==========================================

  const handleSignupMode = () => {
    setIsSignup(true);

    // Registration is always for students.
    setSelectedRole('student');

    setPassword('');
    setDebugMessage('');
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <ScrollView
      contentContainerStyle={
        styles.scrollContainer
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
        style={styles.innerContainer}
      >

        {/* =====================================
            TOP BRAND AREA
        ===================================== */}

        <View style={styles.headerContainer}>

          {/* LOGO */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/tabIcons/imagesss.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

       

          {/* TITLE */}
          <Text style={styles.title}>
            {isSignup
              ? 'Create Your Account'
              : 'Welcome Back'}
          </Text>

          {/* SUBTITLE */}
          <Text style={styles.subtitle}>
            {isSignup
              ? 'Register your student account to get started'
              : 'Sign in to your VProTech Portal account'}
          </Text>
        </View>

        {/* =====================================
            ROLE SELECTOR
            HIDDEN DURING SIGNUP
        ===================================== */}

        {!isSignup && (
          <View style={styles.roleSection}>

            <Text style={styles.roleSectionTitle}>
              Sign in as
            </Text>

            <View
              style={
                styles.roleTabContainer
              }
            >

              {/* STUDENT */}

              <TouchableOpacity
                style={[
                  styles.roleTab,
                  selectedRole === 'student' &&
                    styles.activeRoleTab,
                ]}
                onPress={() =>
                  setSelectedRole('student')
                }
                disabled={loading}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.roleIcon,
                    selectedRole === 'student' &&
                      styles.activeRoleIcon,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleIconText,
                      selectedRole ===
                        'student' &&
                        styles.activeRoleIconText,
                    ]}
                  >
                    S
                  </Text>
                </View>

                <View>
                  <Text
                    style={[
                      styles.roleTabText,
                      selectedRole ===
                        'student' &&
                        styles.activeRoleTabText,
                    ]}
                  >
                    Student
                  </Text>

                  <Text
                    style={[
                      styles.roleDescription,
                      selectedRole ===
                        'student' &&
                        styles.activeRoleDescription,
                    ]}
                  >
                    Student Portal
                  </Text>
                </View>
              </TouchableOpacity>

              {/* FACULTY */}

              <TouchableOpacity
                style={[
                  styles.roleTab,
                  selectedRole === 'faculty' &&
                    styles.activeRoleTab,
                ]}
                onPress={() =>
                  setSelectedRole('faculty')
                }
                disabled={loading}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.roleIcon,
                    selectedRole === 'faculty' &&
                      styles.activeRoleIcon,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleIconText,
                      selectedRole ===
                        'faculty' &&
                        styles.activeRoleIconText,
                    ]}
                  >
                    F
                  </Text>
                </View>

                <View>
                  <Text
                    style={[
                      styles.roleTabText,
                      selectedRole ===
                        'faculty' &&
                        styles.activeRoleTabText,
                    ]}
                  >
                    Faculty
                  </Text>

                  <Text
                    style={[
                      styles.roleDescription,
                      selectedRole ===
                        'faculty' &&
                        styles.activeRoleDescription,
                    ]}
                  >
                    Faculty Portal
                  </Text>
                </View>
              </TouchableOpacity>

            </View>
          </View>
        )}

        {/* =====================================
            SIGNUP INFORMATION
        ===================================== */}

        {isSignup && (
          <View style={styles.signupInfo}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>
                ✓
              </Text>
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                Student Registration
              </Text>

              <Text style={styles.infoText}>
                Create your student account using
                your name, email and password.
              </Text>
            </View>
          </View>
        )}

        {/* =====================================
            FORM CARD
        ===================================== */}

        <View style={styles.card}>

          {/* CARD HEADER */}

          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isSignup
                ? 'Student Registration'
                : `${selectedRole === 'student'
                    ? 'Student'
                    : 'Faculty'
                  } Sign In`}
            </Text>

            <Text style={styles.cardSubtitle}>
              {isSignup
                ? 'Enter your details below'
                : 'Enter your credentials to continue'}
            </Text>
          </View>

          {/* =====================================
              FULL NAME - SIGNUP ONLY
          ===================================== */}

          {isSignup && (
            <View
              style={styles.inputGroup}
            >
              <Text style={styles.label}>
                Full Name
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          )}

          {/* =====================================
              EMAIL
          ===================================== */}

          <View
            style={styles.inputGroup}
          >
            <Text style={styles.label}>
              Email Address
            </Text>

            <TextInput
              style={styles.input}
              placeholder="name@college.edu"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* =====================================
              PASSWORD
          ===================================== */}

          <View
            style={styles.inputGroup}
          >
            <Text style={styles.label}>
              Password
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* =====================================
              PASSWORD REQUIREMENTS
          ===================================== */}

          {isSignup && (
            <View style={styles.passwordRequirementBox}>
              <Text style={styles.requirementTitle}>
                Password requirements
              </Text>

              <Text style={styles.passwordHint}>
                • 12–128 characters
              </Text>

              <Text style={styles.passwordHint}>
                • At least one uppercase letter
              </Text>

              <Text style={styles.passwordHint}>
                • At least one lowercase letter
              </Text>

              <Text style={styles.passwordHint}>
                • At least one number
              </Text>

              <Text style={styles.passwordHint}>
                • At least one special character
              </Text>
            </View>
          )}

          {/* =====================================
              FORGOT PASSWORD
          ===================================== */}

          {!isSignup && (
           <TouchableOpacity
  style={styles.forgotPassword}
  onPress={() =>
    router.push('/forgot-password' as any)
  }
  disabled={loading}
>
  <Text style={styles.forgotText}>
    Forgot Password?
  </Text>
</TouchableOpacity>
          )}

          {/* =====================================
              ACTION BUTTON
          ===================================== */}

          <TouchableOpacity
            style={[
              styles.loginButton,
              loading &&
                styles.disabledButton,
            ]}
            onPress={handleAuthAction}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator
                color="#FFFFFF"
                size="small"
              />
            ) : (
              <>
                <Text
                  style={
                    styles.loginButtonText
                  }
                >
                  {isSignup
                    ? 'Create Student Account'
                    : `Sign In as ${
                        selectedRole ===
                        'student'
                          ? 'Student'
                          : 'Faculty'
                      }`}
                </Text>

                <Text style={styles.buttonArrow}>
                  →
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* =====================================
              DEBUG / STATUS MESSAGE
          ===================================== */}

          {debugMessage ? (
            <View
              style={
                styles.debugBox
              }
            >
              <Text
                style={
                  styles.debugText
                }
              >
                {debugMessage}
              </Text>
            </View>
          ) : null}

          {/* =====================================
              LOGIN / SIGNUP SWITCH
          ===================================== */}

          <View
            style={
              styles.switchContainer
            }
          >
            <Text
              style={
                styles.switchText
              }
            >
              {isSignup
                ? 'Already have an account?'
                : "Don't have an account?"}
            </Text>

            <TouchableOpacity
              onPress={
                isSignup
                  ? handleLoginMode
                  : handleSignupMode
              }
              disabled={loading}
            >
              <Text
                style={
                  styles.switchActionText
                }
              >
                {isSignup
                  ? ' Sign In'
                  : ' Sign Up'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* =====================================
            SECURITY NOTE
        ===================================== */}

        <View style={styles.securityContainer}>
          <View style={styles.securityIcon}>
            <Text style={styles.securityIconText}>
              ✓
            </Text>
          </View>

          <Text style={styles.securityText}>
            Your account information is securely
            protected.
          </Text>
        </View>

        {/* =====================================
            FOOTER
        ===================================== */}

        <View
          style={
            styles.footerContainer
          }
        >
          <Text
            style={
              styles.footerText
            }
          >
            Need assistance?{' '}
          </Text>

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'IT Helpdesk',
                'Please contact your institution administrator.'
              )
            }
          >
            <Text
              style={
                styles.supportText
              }
            >
              Contact IT Helpdesk
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.copyright}>
          VProTech Digital • Portal
        </Text>

      </KeyboardAvoidingView>
    </ScrollView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({

  // ========================================
  // MAIN CONTAINER
  // ========================================

  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#F4F7FB',
    justifyContent: 'center',
    paddingVertical: 35,
  },

  innerContainer: {
    width: '100%',
    maxWidth: 470,
    alignSelf: 'center',
    paddingHorizontal: 22,
  },

  // ========================================
  // HEADER
  // ========================================

  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },

 logoContainer: {
  width: 175,
  height: 85,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 4,
},
  logo: {
    width: 155,
    height: 72,
  },

  portalLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#2563EB',
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  title: {
    fontSize: 29,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 7,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 370,
  },

  // ========================================
  // ROLE SECTION
  // ========================================

  roleSection: {
    width: '100%',
    marginBottom: 18,
  },

  roleSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginLeft: 2,
  },

  roleTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  roleTab: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  activeRoleTab: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },

  roleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeRoleIcon: {
    backgroundColor: '#2563EB',
  },

  roleIconText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '800',
  },

  activeRoleIconText: {
    color: '#FFFFFF',
  },

  roleTabText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },

  activeRoleTabText: {
    color: '#2563EB',
  },

  roleDescription: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },

  activeRoleDescription: {
    color: '#60A5FA',
  },

  // ========================================
  // SIGNUP INFO
  // ========================================

  signupInfo: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 13,
    padding: 13,
    marginBottom: 18,
  },

  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  infoIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },

  infoText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
  },

  // ========================================
  // FORM CARD
  // ========================================

  card: {
    backgroundColor: '#FFFFFF',
    padding: 25,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },

  cardHeader: {
    marginBottom: 22,
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // ========================================
  // INPUTS
  // ========================================

  inputGroup: {
    marginBottom: 17,
    width: '100%',
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 7,
  },

  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 11,
    paddingHorizontal: 15,
    height: 50,
    fontSize: 14,
    color: '#0F172A',
    width: '100%',
  },

  // ========================================
  // PASSWORD REQUIREMENTS
  // ========================================

  passwordRequirementBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 11,
    padding: 12,
    marginTop: -5,
    marginBottom: 17,
  },

  requirementTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 5,
  },

  passwordHint: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 16,
  },

  // ========================================
  // FORGOT PASSWORD
  // ========================================

  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 17,
  },

  forgotText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },

  // ========================================
  // BUTTON
  // ========================================

  loginButton: {
    backgroundColor: '#2563EB',
    height: 51,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
    marginTop: 4,
    shadowColor: '#2563EB',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },

  disabledButton: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '600',
    marginLeft: 8,
    marginTop: -1,
  },

  // ========================================
  // DEBUG / STATUS
  // ========================================

  debugBox: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
  },

  debugText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
  },

  // ========================================
  // LOGIN / SIGNUP SWITCH
  // ========================================

  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },

  switchText: {
    color: '#64748B',
    fontSize: 12,
  },

  switchActionText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
  },

  // ========================================
  // SECURITY
  // ========================================

  securityContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 19,
    paddingHorizontal: 10,
  },

  securityIcon: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },

  securityIconText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '900',
  },

  securityText: {
    color: '#94A3B8',
    fontSize: 10,
  },

  // ========================================
  // FOOTER
  // ========================================

  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    width: '100%',
  },

  footerText: {
    color: '#64748B',
    fontSize: 11,
  },

  supportText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '700',
  },

  copyright: {
    color: '#CBD5E1',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 12,
  },
});