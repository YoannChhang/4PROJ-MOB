// Temporary types, need to connect to BE first

export interface User {
    id: string;
    name: string;
    email: string;
  }
  
  export interface ApiResponse<T> {
    data: T;
    error?: string;
    message: string;
    status: string;
  }
  