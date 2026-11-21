import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import * as DocumentPicker from 'expo-document-picker';

import { useRouter } from 'expo-router';

import API from '../../api/apiClient';

// ==================================================
// TYPES
// ==================================================

type SelectedFile = {
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type UploadNotice = {
  title: string;
  message: string;
  tone: 'error' | 'success';
};

type Material = {
  _id?: string;
  id?: string;
  title?: string;
  batch?: string;
  type?: 'note' | 'video' | string;
  fileUrl?: string;
  publicId?: string;
  originalName?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
  isActive?: boolean;
};

// ==================================================
// COMPONENT
// ==================================================

export default function UploadMaterials() {
  const router = useRouter();

  // ==================================================
  // FORM
  // ==================================================

  const [title, setTitle] = useState('');

  const [batch, setBatch] = useState('');

  const [type, setType] =
    useState<'note' | 'video'>('note');

  const [selectedFile, setSelectedFile] =
    useState<SelectedFile | null>(null);

  // ==================================================
  // MATERIALS
  // ==================================================

  const [materials, setMaterials] =
    useState<Material[]>([]);

  // ==================================================
  // STATES
  // ==================================================

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [uploadNotice, setUploadNotice] =
    useState<UploadNotice | null>(null);

  const showUploadMessage = (
    title: string,
    message: string,
    tone: UploadNotice['tone'] = 'error'
  ) => {
    if (Platform.OS === 'web') {
      setUploadNotice({
        title,
        message,
        tone,
      });
      return;
    }

    Alert.alert(title, message);
  };

  // ==================================================
  // LOAD MATERIALS
  // ==================================================

  const loadMaterials = useCallback(async () => {
    try {
      setError('');

      const response = await API.get(
        '/materials/my'
      );

      const data = response?.data || {};

      console.log(
        '================================='
      );

      console.log(
        'FACULTY MATERIALS RESPONSE:',
        data
      );

      console.log(
        '================================='
      );

      // ----------------------------------------------
      // FORMAT 1
      // ----------------------------------------------

      if (Array.isArray(data.materials)) {
        setMaterials(data.materials);
        return;
      }

      // ----------------------------------------------
      // FORMAT 2
      // ----------------------------------------------

      if (Array.isArray(data.data)) {
        setMaterials(data.data);
        return;
      }

      // ----------------------------------------------
      // FORMAT 3
      // ----------------------------------------------

      if (
        Array.isArray(
          data?.data?.materials
        )
      ) {
        setMaterials(
          data.data.materials
        );

        return;
      }

      setMaterials([]);
    } catch (error: any) {
      console.log(
        'GET FACULTY MATERIALS ERROR:',
        error?.response?.data ||
          error?.message ||
          error
      );

      const status =
        error?.response?.status;

      const serverMessage =
        error?.response?.data?.message;

      let message =
        serverMessage ||
        error?.message ||
        'Unable to load study materials.';

      if (status === 401) {
        message =
          'Your session has expired. Please login again.';
      } else if (status === 403) {
        message =
          'You do not have permission to view faculty materials.';
      } else if (status === 404) {
        message =
          'Faculty materials API endpoint was not found.';
      } else if (
        error?.code === 'ERR_NETWORK'
      ) {
        message =
          'Unable to connect to the server. Please check your API server.';
      }

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // ==================================================
  // REFRESH
  // ==================================================

  const handleRefresh = useCallback(
    async () => {
      setRefreshing(true);

      await loadMaterials();
    },
    [loadMaterials]
  );

  // ==================================================
  // PICK FILE
  // ==================================================

  const pickFile = async () => {
    try {
      const result =
        await DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'video/mp4',
            'video/quicktime',
            'video/webm',
          ],

          copyToCacheDirectory: true,

          multiple: false,
        });

      if (result.canceled) {
        return;
      }

      const file =
        result.assets?.[0];

      if (!file) {
        return;
      }

      if (file.size && file.size > MAX_FILE_SIZE) {
        showUploadMessage(
          'File too large',
          'Please select a file that is 10 MB or smaller.'
        );
        return;
      }

      console.log(
        '================================='
      );

      console.log(
        'SELECTED FILE:'
      );

      console.log(
        'URI:',
        file.uri
      );

      console.log(
        'NAME:',
        file.name
      );

      console.log(
        'MIME:',
        file.mimeType
      );

      console.log(
        'SIZE:',
        file.size
      );

      console.log(
        'PLATFORM:',
        Platform.OS
      );

      console.log(
        '================================='
      );

      setSelectedFile({
        uri: file.uri,

        name:
          file.name ||
          'uploaded-file',

        mimeType:
          file.mimeType ||
          'application/octet-stream',

        size: file.size,
      });
    } catch (error) {
      console.log(
        'FILE PICKER ERROR:',
        error
      );

      showUploadMessage(
        'Error',
        'Unable to select the file.'
      );
    }
  };

  // ==================================================
  // REMOVE FILE
  // ==================================================

  const removeSelectedFile = () => {
    if (uploading) {
      return;
    }

    setSelectedFile(null);
  };

  // ==================================================
  // FILE SIZE
  // ==================================================

  const formatFileSize = (
    size?: number
  ) => {
    if (!size || size <= 0) {
      return 'Size unavailable';
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(
        size / 1024
      ).toFixed(1)} KB`;
    }

    if (
      size <
      1024 * 1024 * 1024
    ) {
      return `${(
        size /
        1024 /
        1024
      ).toFixed(2)} MB`;
    }

    return `${(
      size /
      1024 /
      1024 /
      1024
    ).toFixed(2)} GB`;
  };

  // ==================================================
  // CREATE WEB FILE
  // ==================================================

  const createWebFile = async (
    file: SelectedFile
  ) => {
    if (!file.uri) {
      throw new Error(
        'Selected file URI is missing.'
      );
    }

    console.log(
      '================================='
    );

    console.log(
      'WEB FILE UPLOAD STARTED'
    );

    console.log(
      'URI:',
      file.uri
    );

    console.log(
      'NAME:',
      file.name
    );

    console.log(
      'MIME:',
      file.mimeType
    );

    // ------------------------------------------------
    // Blob URL
    // ------------------------------------------------

    const blobResponse =
      await fetch(file.uri);

    if (!blobResponse.ok) {
      throw new Error(
        `Unable to read selected file. Status: ${blobResponse.status}`
      );
    }

    const blob =
      await blobResponse.blob();

    console.log(
      'WEB BLOB CREATED'
    );

    console.log(
      'BLOB SIZE:',
      blob.size
    );

    console.log(
      'BLOB TYPE:',
      blob.type
    );

    if (!blob.size) {
      throw new Error(
        'Selected file is empty.'
      );
    }

    const fileName =
      file.name ||
      'uploaded-file';

    const mimeType =
      file.mimeType ||
      blob.type ||
      'application/octet-stream';

    // ------------------------------------------------
    // IMPORTANT
    // Use File when available so backend receives
    // an actual filename.
    // ------------------------------------------------

    if (
      typeof File !== 'undefined'
    ) {
      const webFile =
        new File(
          [blob],
          fileName,
          {
            type: mimeType,
          }
        );

      console.log(
        'WEB FILE CREATED:',
        {
          name: webFile.name,
          type: webFile.type,
          size: webFile.size,
        }
      );

      console.log(
        '================================='
      );

      return webFile;
    }

    console.log(
      'USING BLOB FALLBACK'
    );

    console.log(
      '================================='
    );

    return blob;
  };

  // ==================================================
  // UPLOAD
  // ==================================================

  const uploadMaterial = async () => {
    setUploadNotice(null);

    try {
      // ----------------------------------------------
      // VALIDATION
      // ----------------------------------------------

      if (!title.trim()) {
        showUploadMessage(
          'Required',
          'Please enter material title.'
        );

        return;
      }

      if (!batch.trim()) {
        showUploadMessage(
          'Required',
          'Please enter batch / cohort.'
        );

        return;
      }

      if (!selectedFile) {
        showUploadMessage(
          'Required',
          'Please select a file.'
        );

        return;
      }

      setUploading(true);

      // ----------------------------------------------
      // CREATE FORM DATA
      // ----------------------------------------------

      const formData =
        new FormData();

      formData.append(
        'title',
        title.trim()
      );

      formData.append(
        'batch',
        batch.trim()
      );

      formData.append(
        'type',
        type
      );

      // ----------------------------------------------
      // FILE
      // ----------------------------------------------

      if (
        Platform.OS === 'web'
      ) {
        // ============================================
        // WEB
        // ============================================

        const webFile =
          await createWebFile(
            selectedFile
          );

        formData.append(
          'file',
          webFile as any
        );

        console.log(
          'WEB FORMDATA FILE:',
          {
            name:
              selectedFile.name,
            type:
              selectedFile.mimeType,
            size:
              selectedFile.size,
          }
        );
      } else {
        // ============================================
        // ANDROID / IOS
        // ============================================

        const fileObject = {
          uri: selectedFile.uri,

          name:
            selectedFile.name ||
            'uploaded-file',

          type:
            selectedFile.mimeType ||
            'application/octet-stream',
        };

        formData.append(
          'file',
          fileObject as any
        );

        console.log(
          'NATIVE FORMDATA FILE:',
          fileObject
        );
      }

      // ----------------------------------------------
      // DEBUG
      // ----------------------------------------------

      console.log(
        '================================='
      );

      console.log(
        'UPLOADING MATERIAL'
      );

      console.log(
        'PLATFORM:',
        Platform.OS
      );

      console.log(
        'TITLE:',
        title.trim()
      );

      console.log(
        'BATCH:',
        batch.trim()
      );

      console.log(
        'TYPE:',
        type
      );

      console.log(
        'SELECTED FILE:',
        selectedFile
      );

      console.log(
        'IS FORMDATA:',
        formData instanceof FormData
      );

      console.log(
        '================================='
      );

      // ----------------------------------------------
      // IMPORTANT
      //
      // DO NOT manually set:
      //
      // Content-Type: application/json
      //
      // Axios/browser must generate the multipart
      // boundary automatically.
      // ----------------------------------------------

      const response =
        await API.post(
          '/materials/upload',
          formData
        );

      const data =
        response?.data || {};

      console.log(
        '================================='
      );

      console.log(
        'UPLOAD RESPONSE:',
        data
      );

      console.log(
        '================================='
      );

      // ----------------------------------------------
      // SUCCESS CHECK
      // ----------------------------------------------

      if (
        data?.success === false
      ) {
        throw new Error(
          data?.message ||
            'Unable to upload material.'
        );
      }

      // ----------------------------------------------
      // SUCCESS
      // ----------------------------------------------

      showUploadMessage(
        'Success',
        data?.message ||
          'Study material published successfully.',
        'success'
      );

      // ----------------------------------------------
      // RESET
      // ----------------------------------------------

      setTitle('');

      setBatch('');

      setType('note');

      setSelectedFile(null);

      // ----------------------------------------------
      // RELOAD
      // ----------------------------------------------

      await loadMaterials();
    } catch (error: any) {
      console.log(
        '================================='
      );

      console.log(
        'UPLOAD MATERIAL ERROR'
      );

      console.log(
        'STATUS:',
        error?.response?.status
      );

      console.log(
        'DATA:',
        error?.response?.data
      );

      console.log(
        'MESSAGE:',
        error?.message
      );

      console.log(
        'CODE:',
        error?.code
      );

      console.log(
        '================================='
      );

      const status =
        error?.response?.status;

      let message =
        error?.response?.data
          ?.message ||
        error?.message ||
        'Unable to upload study material.';

      if (status === 400) {
        message =
          error?.response?.data
            ?.message ||
          'Invalid upload request. Please check the material details and file.';
      } else if (status === 401) {
        message =
          'Your session has expired. Please login again.';
      } else if (status === 403) {
        message =
          'You do not have permission to upload materials.';
      } else if (status === 404) {
        message =
          'Upload API endpoint was not found.';
      } else if (status >= 500) {
        message =
          error?.response?.data
            ?.message ||
          'Server error while processing the uploaded material.';
      } else if (
        error?.code ===
        'ERR_NETWORK'
      ) {
        message =
          'Unable to connect to the server. Please check your API server.';
      }

      showUploadMessage(
        'Upload Failed',
        message
      );
    } finally {
      setUploading(false);
    }
  };

  // ==================================================
  // DELETE
  // ==================================================

  const deleteMaterial = (
    material: Material
  ) => {
    const materialId =
      material?._id ||
      material?.id;

    if (!materialId) {
      Alert.alert(
        'Error',
        'Material ID is missing.'
      );

      return;
    }

    Alert.alert(
      'Delete Material',
      `Are you sure you want to delete "${
        material.title ||
        'this material'
      }"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },

        {
          text: 'Delete',

          style: 'destructive',

          onPress: async () => {
            try {
              await API.delete(
                `/materials/${materialId}`
              );

              Alert.alert(
                'Deleted',
                'Study material deleted successfully.'
              );

              await loadMaterials();
            } catch (
              error: any
            ) {
              console.log(
                'DELETE MATERIAL ERROR:',
                error?.response
                  ?.data ||
                  error?.message ||
                  error
              );

              Alert.alert(
                'Error',
                error?.response
                  ?.data
                  ?.message ||
                  error?.message ||
                  'Unable to delete material.'
              );
            }
          },
        },
      ]
    );
  };

  // ==================================================
  // ICON
  // ==================================================

  const getFileIcon = (
    material: Material
  ): keyof typeof Ionicons.glyphMap => {
    const mimeType =
      material?.mimeType
        ?.toLowerCase() ||
      '';

    if (
      mimeType.includes('video') ||
      material?.type === 'video'
    ) {
      return 'videocam-outline';
    }

    if (
      mimeType.includes('image')
    ) {
      return 'image-outline';
    }

    return 'document-text-outline';
  };

  // ==================================================
  // DATE
  // ==================================================

  const formatDate = (
    date?: string
  ) => {
    if (!date) {
      return '';
    }

    try {
      return new Date(
        date
      ).toLocaleDateString(
        'en-IN',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }
      );
    } catch {
      return '';
    }
  };

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <View
            style={
              styles.loadingIcon
            }
          >
            <Ionicons
              name="cloud-upload-outline"
              size={32}
              color="#1769AA"
            />
          </View>

          <ActivityIndicator
            size="large"
            color="#1769AA"
          />

          <Text
            style={
              styles.loadingTitle
            }
          >
            Loading Materials
          </Text>

          <Text
            style={
              styles.loadingText
            }
          >
            Please wait...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==================================================
  // UI
  // ==================================================

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={
              handleRefresh
            }
            tintColor="#1769AA"
          />
        }
      >
        {/* HEADER */}

        <View
          style={styles.header}
        >
          <Pressable
            style={
              styles.backButton
            }
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/faculty-dashboard')
            }
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#183B56"
            />
          </Pressable>

          <View
            style={
              styles.headerText
            }
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              Upload Materials
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Share study material with students
            </Text>
          </View>
        </View>

        {/* ERROR */}

        {error ? (
          <View
            style={
              styles.errorBox
            }
          >
            <View
              style={
                styles.errorIcon
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color="#C62828"
              />
            </View>

            <View
              style={
                styles.errorContent
              }
            >
              <Text
                style={
                  styles.errorTitle
                }
              >
                Materials Notice
              </Text>

              <Text
                style={
                  styles.errorText
                }
              >
                {error}
              </Text>

              <Pressable
                style={
                  styles.retryButton
                }
                onPress={
                  loadMaterials
                }
              >
                <Text
                  style={
                    styles.retryText
                  }
                >
                  Try Again
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* UPLOAD FORM */}

        <View
          style={styles.section}
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={
                styles.sectionIcon
              }
            >
              <Ionicons
                name="cloud-upload-outline"
                size={23}
                color="#1769AA"
              />
            </View>

            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Upload Material
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Add notes, images or videos
              </Text>
            </View>
          </View>

          {/* TITLE */}

          <Text
            style={styles.label}
          >
            Material Title
          </Text>

          <TextInput
            value={title}
            onChangeText={
              setTitle
            }
            placeholder="e.g. React JS Notes"
            placeholderTextColor="#9AA7B5"
            style={styles.input}
            editable={!uploading}
          />

          {/* BATCH */}

          <Text
            style={styles.label}
          >
            Batch / Cohort
          </Text>

          <TextInput
            value={batch}
            onChangeText={
              setBatch
            }
            placeholder="e.g. 2024-2028"
            placeholderTextColor="#9AA7B5"
            style={styles.input}
            editable={!uploading}
          />

          <Text
            style={
              styles.helperText
            }
          >
            Enter the batch or cohort that should receive
            this material.
          </Text>

          {/* TYPE */}

          <Text
            style={styles.label}
          >
            Material Type
          </Text>

          <View
            style={
              styles.typeContainer
            }
          >
            <Pressable
              style={[
                styles.typeButton,
                type === 'note' &&
                  styles.typeButtonActive,
              ]}
              onPress={() =>
                setType('note')
              }
              disabled={uploading}
            >
              <Ionicons
                name="document-text-outline"
                size={19}
                color={
                  type === 'note'
                    ? '#FFFFFF'
                    : '#1769AA'
                }
              />

              <Text
                style={[
                  styles.typeText,
                  type === 'note' &&
                    styles.typeTextActive,
                ]}
              >
                Note
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.typeButton,
                type === 'video' &&
                  styles.typeButtonActive,
              ]}
              onPress={() =>
                setType('video')
              }
              disabled={uploading}
            >
              <Ionicons
                name="videocam-outline"
                size={19}
                color={
                  type === 'video'
                    ? '#FFFFFF'
                    : '#1769AA'
                }
              />

              <Text
                style={[
                  styles.typeText,
                  type === 'video' &&
                    styles.typeTextActive,
                ]}
              >
                Video
              </Text>
            </Pressable>
          </View>

          {/* FILE */}

          <Text
            style={styles.label}
          >
            Study Material File
          </Text>

          {!selectedFile ? (
            <Pressable
              style={({
                pressed,
              }) => [
                styles.filePicker,
                pressed &&
                  styles.filePickerPressed,
              ]}
              onPress={pickFile}
              disabled={uploading}
            >
              <View
                style={
                  styles.fileIcon
                }
              >
                <Ionicons
                  name="document-attach-outline"
                  size={27}
                  color="#1769AA"
                />
              </View>

              <View
                style={
                  styles.filePickerContent
                }
              >
                <Text
                  style={
                    styles.filePickerTitle
                  }
                >
                  Select File
                </Text>

                <Text
                  style={
                    styles.filePickerText
                  }
                >
                  PDF, JPG, PNG, WEBP or supported video (up to 10 MB)
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color="#9AA7B5"
              />
            </Pressable>
          ) : (
            <View
              style={
                styles.selectedFile
              }
            >
              <View
                style={
                  styles.selectedFileIcon
                }
              >
                <Ionicons
                  name="document-outline"
                  size={25}
                  color="#1769AA"
                />
              </View>

              <View
                style={
                  styles.selectedFileContent
                }
              >
                <Text
                  style={
                    styles.selectedFileName
                  }
                  numberOfLines={2}
                >
                  {selectedFile.name ||
                    'Selected file'}
                </Text>

                <Text
                  style={
                    styles.selectedFileType
                  }
                >
                  {selectedFile.mimeType ||
                    'File selected'}

                  {selectedFile.size
                    ? ` • ${formatFileSize(
                        selectedFile.size
                      )}`
                    : ''}
                </Text>
              </View>

              <Pressable
                style={
                  styles.removeFileButton
                }
                onPress={
                  removeSelectedFile
                }
                disabled={uploading}
              >
                <Ionicons
                  name="close-circle"
                  size={24}
                  color="#C62828"
                />
              </Pressable>
            </View>
          )}

          {uploadNotice ? (
            <View
              style={[
                styles.uploadNotice,
                uploadNotice.tone === 'success'
                  ? styles.uploadNoticeSuccess
                  : styles.uploadNoticeError,
              ]}
            >
              <Text
                style={[
                  styles.uploadNoticeTitle,
                  uploadNotice.tone === 'success'
                    ? styles.uploadNoticeSuccessText
                    : styles.uploadNoticeErrorText,
                ]}
              >
                {uploadNotice.title}
              </Text>

              <Text
                style={[
                  styles.uploadNoticeMessage,
                  uploadNotice.tone === 'success'
                    ? styles.uploadNoticeSuccessText
                    : styles.uploadNoticeErrorText,
                ]}
              >
                {uploadNotice.message}
              </Text>
            </View>
          ) : null}

          {/* UPLOAD */}

          <Pressable
            style={({
              pressed,
            }) => [
              styles.uploadButton,

              pressed &&
                styles.uploadButtonPressed,

              uploading &&
                styles.uploadButtonDisabled,
            ]}
            onPress={
              uploadMaterial
            }
            disabled={uploading}
          >
            {uploading ? (
              <>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.uploadButtonText
                  }
                >
                  Uploading...
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={21}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.uploadButtonText
                  }
                >
                  Publish Material
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* MATERIAL LIST */}

        <View
          style={
            styles.listHeader
          }
        >
          <View>
            <Text
              style={
                styles.listTitle
              }
            >
              My Materials
            </Text>

            <Text
              style={
                styles.listSubtitle
              }
            >
              {materials.length}{' '}
              {materials.length === 1
                ? 'material'
                : 'materials'}{' '}
              published
            </Text>
          </View>
        </View>

        {materials.length > 0 ? (
          <View
            style={
              styles.materialList
            }
          >
            {materials.map(
              (
                material,
                index
              ) => (
                <View
                  key={
                    material?._id ||
                    material?.id ||
                    `material-${index}`
                  }
                  style={
                    styles.materialCard
                  }
                >
                  <View
                    style={
                      styles.materialIcon
                    }
                  >
                    <Ionicons
                      name={getFileIcon(
                        material
                      )}
                      size={25}
                      color="#1769AA"
                    />
                  </View>

                  <View
                    style={
                      styles.materialContent
                    }
                  >
                    <Text
                      style={
                        styles.materialTitle
                      }
                      numberOfLines={2}
                    >
                      {material?.title ||
                        'Untitled Material'}
                    </Text>

                    <View
                      style={
                        styles.materialMeta
                      }
                    >
                      <View
                        style={
                          styles.metaItem
                        }
                      >
                        <Ionicons
                          name="people-outline"
                          size={14}
                          color="#718096"
                        />

                        <Text
                          style={
                            styles.metaText
                          }
                        >
                          {material?.batch ||
                            'Batch unavailable'}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.metaItem
                        }
                      >
                        <Ionicons
                          name={
                            material?.type ===
                            'video'
                              ? 'videocam-outline'
                              : 'document-text-outline'
                          }
                          size={14}
                          color="#718096"
                        />

                        <Text
                          style={
                            styles.metaText
                          }
                        >
                          {material?.type ===
                          'video'
                            ? 'Video'
                            : 'Note'}
                        </Text>
                      </View>
                    </View>

                    {(
                      material?.originalName ||
                      material?.fileName
                    ) ? (
                      <Text
                        style={
                          styles.fileName
                        }
                        numberOfLines={1}
                      >
                        {material?.originalName ||
                          material?.fileName}
                      </Text>
                    ) : null}

                    {material?.size ? (
                      <Text
                        style={
                          styles.fileSize
                        }
                      >
                        {formatFileSize(
                          material.size
                        )}
                      </Text>
                    ) : null}

                    {material?.createdAt ? (
                      <Text
                        style={
                          styles.createdAt
                        }
                      >
                        Published{' '}
                        {formatDate(
                          material.createdAt
                        )}
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    style={
                      styles.deleteButton
                    }
                    onPress={() =>
                      deleteMaterial(
                        material
                      )
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color="#C62828"
                    />
                  </Pressable>
                </View>
              )
            )}
          </View>
        ) : (
          <View
            style={
              styles.emptyBox
            }
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Ionicons
                name="documents-outline"
                size={30}
                color="#1769AA"
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No materials yet
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Upload your first study material and it
              will appear here.
            </Text>
          </View>
        )}

        <View
          style={
            styles.bottomSpace
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================================================
// STYLES
// ==================================================

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#F7FAFC',
    },

    container: {
      flex: 1,
      backgroundColor: '#F7FAFC',
    },

    content: {
      padding: 18,
      paddingBottom: 35,
    },

    // ----------------------------------------------
    // HEADER
    // ----------------------------------------------

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 22,
    },

    backButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    headerText: {
      flex: 1,
    },

    headerTitle: {
      fontSize: 23,
      fontWeight: '800',
      color: '#183B56',
    },

    headerSubtitle: {
      fontSize: 13,
      color: '#718096',
      marginTop: 3,
    },

    // ----------------------------------------------
    // ERROR
    // ----------------------------------------------

    errorBox: {
      flexDirection: 'row',
      backgroundColor: '#FFF7F7',
      borderWidth: 1,
      borderColor: '#FED7D7',
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
    },

    errorIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FEE2E2',
      marginRight: 10,
    },

    errorContent: {
      flex: 1,
    },

    errorTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#9B2C2C',
    },

    errorText: {
      fontSize: 13,
      lineHeight: 19,
      color: '#C53030',
      marginTop: 4,
    },

    retryButton: {
      alignSelf: 'flex-start',
      marginTop: 10,
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: '#1769AA',
    },

    retryText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },

    // ----------------------------------------------
    // SECTION
    // ----------------------------------------------

    section: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E7EDF3',
      padding: 17,
      marginBottom: 28,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 16,
      marginBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: '#EDF1F5',
    },

    sectionIcon: {
      width: 45,
      height: 45,
      borderRadius: 13,
      backgroundColor: '#EAF3FA',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: '#183B56',
    },

    sectionSubtitle: {
      fontSize: 12,
      color: '#7B8794',
      marginTop: 2,
    },

    // ----------------------------------------------
    // FORM
    // ----------------------------------------------

    label: {
      fontSize: 13,
      fontWeight: '700',
      color: '#183B56',
      marginTop: 17,
      marginBottom: 7,
    },

    input: {
      height: 48,
      borderWidth: 1,
      borderColor: '#DDE5EC',
      borderRadius: 11,
      backgroundColor: '#FBFCFD',
      paddingHorizontal: 13,
      fontSize: 14,
      color: '#183B56',
    },

    helperText: {
      fontSize: 11,
      lineHeight: 17,
      color: '#8A96A3',
      marginTop: 6,
    },

    uploadNotice: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginTop: 16,
    },

    uploadNoticeSuccess: {
      backgroundColor: '#F0FFF4',
      borderColor: '#9AE6B4',
    },

    uploadNoticeError: {
      backgroundColor: '#FFF5F5',
      borderColor: '#FED7D7',
    },

    uploadNoticeTitle: {
      fontSize: 13,
      fontWeight: '700',
    },

    uploadNoticeMessage: {
      fontSize: 12,
      lineHeight: 18,
      marginTop: 3,
    },

    uploadNoticeSuccessText: {
      color: '#276749',
    },

    uploadNoticeErrorText: {
      color: '#C53030',
    },

    // ----------------------------------------------
    // TYPE
    // ----------------------------------------------

    typeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    typeButton: {
      flex: 1,
      height: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      borderWidth: 1,
      borderColor: '#DDE5EC',
      backgroundColor: '#FFFFFF',
    },

    typeButtonActive: {
      backgroundColor: '#1769AA',
      borderColor: '#1769AA',
    },

    typeText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#1769AA',
      marginLeft: 7,
    },

    typeTextActive: {
      color: '#FFFFFF',
    },

    // ----------------------------------------------
    // FILE PICKER
    // ----------------------------------------------

    filePicker: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#BFD3E3',
      borderRadius: 12,
      backgroundColor: '#F8FBFD',
      padding: 12,
    },

    filePickerPressed: {
      opacity: 0.7,
    },

    fileIcon: {
      width: 45,
      height: 45,
      borderRadius: 12,
      backgroundColor: '#EAF3FA',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    filePickerContent: {
      flex: 1,
    },

    filePickerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#183B56',
    },

    filePickerText: {
      fontSize: 11,
      color: '#7B8794',
      marginTop: 3,
    },

    selectedFile: {
      minHeight: 84,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#DDE5EC',
      borderRadius: 12,
      backgroundColor: '#F8FBFD',
      padding: 12,
    },

    selectedFileIcon: {
      width: 44,
      height: 44,
      borderRadius: 11,
      backgroundColor: '#EAF3FA',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    selectedFileContent: {
      flex: 1,
    },

    selectedFileName: {
      fontSize: 13,
      fontWeight: '700',
      color: '#183B56',
    },

    selectedFileType: {
      fontSize: 10,
      color: '#7B8794',
      marginTop: 3,
    },

    removeFileButton: {
      marginLeft: 8,
      padding: 3,
    },

    // ----------------------------------------------
    // UPLOAD BUTTON
    // ----------------------------------------------

    uploadButton: {
      height: 50,
      borderRadius: 11,
      backgroundColor: '#1769AA',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },

    uploadButtonPressed: {
      opacity: 0.8,
    },

    uploadButtonDisabled: {
      opacity: 0.65,
    },

    uploadButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
      marginLeft: 8,
    },

    // ----------------------------------------------
    // LIST
    // ----------------------------------------------

    listHeader: {
      marginBottom: 13,
    },

    listTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: '#183B56',
    },

    listSubtitle: {
      fontSize: 12,
      color: '#7B8794',
      marginTop: 3,
    },

    materialList: {
      marginBottom: 10,
    },

    materialCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E7EDF3',
      borderRadius: 15,
      padding: 14,
      marginBottom: 10,
    },

    materialIcon: {
      width: 48,
      height: 48,
      borderRadius: 13,
      backgroundColor: '#EAF3FA',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    materialContent: {
      flex: 1,
    },

    materialTitle: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
      color: '#183B56',
    },

    materialMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 7,
    },

    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 13,
    },

    metaText: {
      fontSize: 11,
      color: '#718096',
      marginLeft: 4,
    },

    fileName: {
      fontSize: 10,
      color: '#8A96A3',
      marginTop: 6,
    },

    fileSize: {
      fontSize: 10,
      color: '#1769AA',
      marginTop: 3,
    },

    createdAt: {
      fontSize: 10,
      color: '#A0AEC0',
      marginTop: 3,
    },

    deleteButton: {
      width: 40,
      height: 40,
      borderRadius: 11,
      backgroundColor: '#FFF5F5',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },

    // ----------------------------------------------
    // EMPTY
    // ----------------------------------------------

    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 15,
      borderWidth: 1,
      borderColor: '#E7EDF3',
      padding: 30,
    },

    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: '#EAF3FA',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },

    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#183B56',
    },

    emptyText: {
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 18,
      color: '#7B8794',
      marginTop: 5,
    },

    // ----------------------------------------------
    // LOADING
    // ----------------------------------------------

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
    },

    loadingIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EAF3FA',
      marginBottom: 20,
    },

    loadingTitle: {
      marginTop: 18,
      fontSize: 18,
      fontWeight: '700',
      color: '#183B56',
    },

    loadingText: {
      marginTop: 6,
      fontSize: 14,
      color: '#7B8794',
    },

    bottomSpace: {
      height: 25,
    },
  });