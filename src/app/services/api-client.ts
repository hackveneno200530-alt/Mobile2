import axios from 'axios';
import { environment } from '../../environments/environment';

export const apiClient = axios.create({
  baseURL: environment.apiUrl,
  headers: { 'Content-Type': 'application/json' },
});
