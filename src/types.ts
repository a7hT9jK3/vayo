export type UserRole = 'passenger' | 'driver' | 'admin';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type VehicleCategory = 'delivery_car' | 'delivery_truck_large';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  rating?: number;
  totalRatings?: number;
  positiveRatings?: number;
  negativeRatings?: number;
  isOnline?: boolean;
  vehicleType?: VehicleCategory;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  phoneNumber?: string;
  companyName?: string;
  isVerified?: boolean;
  verificationStatus?: VerificationStatus;
  verificationDate?: any;
  isSuspended?: boolean;
  deletionScheduledAt?: any; // Firestore Timestamp
  darkMode?: boolean;
}

export type RideStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export interface RideRequest {
  id: string;
  passengerId: string;
  passengerName?: string;
  passengerPhone?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverRating?: number;
  driverPositiveRatings?: number;
  driverNegativeRatings?: number;
  status: RideStatus;
  vehicleType?: VehicleCategory;
  isManual?: boolean;
  passengerGPS?: {
    lat: number;
    lng: number;
  };
  pickup: {
    lat: number;
    lng: number;
    address: string;
  };
  destination: {
    lat: number;
    lng: number;
    address: string;
  };
  cargoDetails?: string;
  rated?: boolean;
  createdAt: any; // Firestore Timestamp
}

export interface Review {
  id: string;
  rideId: string;
  passengerId: string;
  driverId: string;
  rating: number;
  comment: string;
  createdAt: any; // Firestore Timestamp
}
