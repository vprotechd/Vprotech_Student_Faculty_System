import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { leaveClassroom } from '../api/classroomApi';
import { COLORS, Header, Screen } from './portal';

export default function LiveClassroomUnavailable() {
  const { classroomId } = useLocalSearchParams<{ classroomId?: string }>();

  useEffect(() => {
    if (classroomId) {
      void leaveClassroom(classroomId).catch((error) => {
        console.warn('Unable to record classroom leave:', error);
      });
    }
  }, [classroomId]);

  return (
    <Screen>
      <Header title="Live classroom" onBack={false} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>
          Live classes require the iOS or Android app.
        </Text>
        <Text style={{ color: COLORS.sub, marginTop: 8, textAlign: 'center' }}>
          Open this class in a native development build with Agora installed.
        </Text>
        <Text
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ color: COLORS.primary, fontWeight: '800', marginTop: 22 }}
        >
          Go back
        </Text>
      </View>
    </Screen>
  );
}
