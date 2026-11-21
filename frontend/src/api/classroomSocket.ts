import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, type Socket } from 'socket.io-client';

import API from './apiClient';

export const createClassroomSocket = async (): Promise<Socket> => {
  const token = await AsyncStorage.getItem('token');
  if (!token) throw new Error('You must sign in before joining a live class.');

  const apiUrl = API.defaults.baseURL || '';
  const socketUrl = apiUrl.replace(/\/api\/?$/, '');
  if (!socketUrl) throw new Error('The API URL is not configured.');

  return io(socketUrl, {
    auth: { token },
    autoConnect: false,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
  });
};
