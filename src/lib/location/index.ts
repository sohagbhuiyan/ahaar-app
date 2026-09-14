/**
 * Delivery location — address helpers and the device-position hook.
 *
 * Location is only ever *where to deliver*. Nothing here, or anything built on
 * it, filters the catalogue or changes a price.
 */
export * from './address';
export {
  useDeviceLocation,
  LOCATE_TIMEOUT_MS,
  LAST_KNOWN_MAX_AGE_MS,
  type DeviceLocation,
  type DeviceLocationState,
  type DeviceLocationStatus,
} from './useDeviceLocation';
