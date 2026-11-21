import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import API from '../api/apiClient'; // Aapke apiClient ka path

export default function UploadScreen() {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 1. File Select karne ka function
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Sabhi tarah ki files (PDF, images, etc.) ke liye
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
        Alert.alert('Success', `File selected: ${result.assets[0].name}`);
      }
    } catch (error) {
      console.error('File picking error:', error);
    }
  };

  // 2. Server par Cloudinary par bhejne ka function
  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Pehle koi file select karein!');
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType || 'application/octet-stream',
      } as any);

      // Aapka backend ka API call jo Cloudinary par upload karega
      const response = await API.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Upload Success:', response.data);
      Alert.alert('Success', 'File successfully Cloudinary par upload ho gayi!');
      setSelectedFile(null); // Reset after upload

    } catch (error: any) {
      console.error('Upload Error:', error.response?.data || error.message);
      Alert.alert('Error', 'File upload fail ho gayi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload File to Cloud</Text>

      <TouchableOpacity style={styles.button} onPress={pickFile}>
        <Text style={styles.buttonText}>
          {selectedFile ? selectedFile.name : 'Choose File'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.uploadButton, !selectedFile && styles.disabledButton]} 
        onPress={handleUpload}
        disabled={!selectedFile || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Upload to Cloud</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  button: { backgroundColor: '#4F46E5', padding: 15, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 15 },
  uploadButton: { backgroundColor: '#10B981', padding: 15, borderRadius: 8, width: '100%', alignItems: 'center' },
  disabledButton: { backgroundColor: '#9CA3AF' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});