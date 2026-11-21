import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

interface StudyNote {
  id: string;
  title: string;
  batch: string;
  fileName: string;
  fileSize: string;
  fileUri: string;
  uploadedAt: string;
}

const AVAILABLE_BATCHES = ['MERN Stack', 'DSA', 'Python Full Stack'];

export default function NotesAndPDFsTab() {
  const [selectedBatch, setSelectedBatch] = useState<string>('MERN Stack');
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([
    {
      id: '1',
      title: 'Data Structures Cheat Sheet',
      batch: 'DSA',
      fileName: 'dsa_cheatsheet.pdf',
      fileSize: '1.2 MB',
      fileUri: 'https://example.com/dsa.pdf',
      uploadedAt: '2 hours ago',
    },
  ]);

  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setPickedFile(file);

        if (!noteTitle && file.name) {
          setNoteTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to select document.');
    }
  };

  const handleRemovePickedFile = () => {
    setPickedFile(null);
  };

  const handlePublishNote = async () => {
    if (!noteTitle.trim()) {
      Alert.alert('Validation Error', 'Please enter a title for the document.');
      return;
    }

    if (!pickedFile) {
      Alert.alert('Validation Error', 'Please attach a document file.');
      return;
    }

    setIsUploading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const newNote: StudyNote = {
        id: Date.now().toString(),
        title: noteTitle.trim(),
        batch: selectedBatch,
        fileName: pickedFile.name,
        fileSize: formatBytes(pickedFile.size),
        fileUri: pickedFile.uri,
        uploadedAt: 'Just now',
      };

      setStudyNotes((prev) => [newNote, ...prev]);

      setNoteTitle('');
      setPickedFile(null);
      Alert.alert('Success', `"${newNote.title}" uploaded successfully!`);
    } catch (error) {
      Alert.alert('Upload Failed', 'Something went wrong while uploading.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* UPLOAD CARD */}
      <View style={styles.uploadCard}>
        <Text style={styles.heading}>Course Materials & PDFs</Text>
        <Text style={styles.subHeading}>Upload files and assign them to active batches</Text>

        <Text style={styles.fieldLabel}>Target Batch</Text>
        <View style={styles.batchContainer}>
          {AVAILABLE_BATCHES.map((batch) => (
            <TouchableOpacity
              key={batch}
              style={[
                styles.batchChip,
                selectedBatch === batch && styles.batchChipSelected,
              ]}
              onPress={() => setSelectedBatch(batch)}
            >
              <Text
                style={[
                  styles.batchChipText,
                  selectedBatch === batch && styles.batchChipTextSelected,
                ]}
              >
                {batch}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>File Attachment</Text>
        {!pickedFile ? (
          <TouchableOpacity style={styles.pickerBox} onPress={handlePickDocument}>
            <Text style={styles.pickerTitle}>Select File</Text>
            <Text style={styles.pickerSub}>PDF, DOC, DOCX, or TXT up to 25MB</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.selectedFileBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedFileName} numberOfLines={1}>
                {pickedFile.name}
              </Text>
              <Text style={styles.selectedFileSize}>
                {formatBytes(pickedFile.size)}
              </Text>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={handleRemovePickedFile}>
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.fieldLabel}>Display Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chapter 1 - Introduction to Trees"
          placeholderTextColor="#94A3B8"
          value={noteTitle}
          onChangeText={setNoteTitle}
        />

        <TouchableOpacity
          style={[styles.publishBtn, isUploading && styles.publishBtnDisabled]}
          onPress={handlePublishNote}
          disabled={isUploading}
        >
          <Text style={styles.publishBtnText}>
            {isUploading ? 'Uploading...' : 'Publish Material'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* UPLOADED LIST */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Uploaded Files ({studyNotes.length})</Text>
        {studyNotes.map((item) => (
          <View key={item.id} style={styles.noteCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.noteTitle}>{item.title}</Text>
              <Text style={styles.batchBadge}>{item.batch}</Text>
            </View>
            <Text style={styles.noteSub}>
              {item.fileName} • {item.fileSize} • {item.uploadedAt}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Base Screen Background: Slate-900 (Deep matte neutral)
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 16,
  },
  // Main Card Surface: Slate-800
  uploadCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subHeading: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  batchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  batchChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  batchChipSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  batchChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  batchChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: '#475569',
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38BDF8',
  },
  pickerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  selectedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  selectedFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  selectedFileSize: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#F8FAFC',
    marginBottom: 16,
  },
  publishBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  publishBtnDisabled: {
    backgroundColor: '#1D4ED8',
    opacity: 0.6,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  listSection: {
    marginTop: 24,
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteCard: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 8,
  },
  batchBadge: {
    fontSize: 11,
    color: '#94A3B8',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noteSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
});