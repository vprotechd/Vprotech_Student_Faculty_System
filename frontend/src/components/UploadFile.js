import React, { useState } from 'react';
import { View, Button, ActivityIndicator, Alert, Text, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import API from '../api/apiClient'

const UploadFile = () => {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  // 1. Phone se file select karne ka function
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'video/*'], // PDF aur Videos dono allow hain
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setFileName(file.name);
        handleUpload(file); // File select hote hi upload start ho jayega
      }
    } catch (error) {
      console.error('Picker Error:', error);
      Alert.alert('Error', 'File select karne mein kuch problem aayi.');
    }
  };

  // 2. Backend par file bhejne ka function
  const handleUpload = async (fileData) => {
    setLoading(true);
    const formData = new FormData();
    
    formData.append('file', {
      uri: fileData.uri,
      name: fileData.name,
      type: fileData.mimeType || 'application/octet-stream',
    });

    try {
      const response = await API.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      Alert.alert('Success', 'File successfully upload ho gayi!');
      setFileName('');
    } catch (error) {
      console.error('Upload Error:', error.response?.data || error.message);
      Alert.alert('Error', 'File upload fail ho gayi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <>
          <Button title="Select & Upload PDF/Video" onPress={pickFile} />
          {fileName ? <Text style={styles.fileText}>Selected: {fileName}</Text> : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fileText: {
    marginTop: 10,
    fontSize: 14,
    color: '#333',
  },
});

export default UploadFile;