import { z } from 'zod';
import {
  registrationSchema,
  applicationSchema,
  bookingSchema,
  cancellationSchema,
  statusUpdateSchema,
  profileUpdateSchema,
  groupChangeRequestSchema,
  sepaMandateSchema,
  trialTrainingSchema,
  personalInfoSchema,
  addressSchema,
  tennisInfoSchema,
  additionalInfoSchema,
  agreementSchema,
  type PersonalInfoFormData,
  type AddressFormData,
  type TennisInfoFormData,
  type AdditionalInfoFormData,
  type AgreementFormData,
  type RegistrationFormData,
  type ApplicationFormData,
  type BookingFormData,
  type CancellationFormData,
  type StatusUpdateFormData,
  type ProfileUpdateFormData,
  type GroupChangeRequestFormData,
  type SepaMandateFormData,
  type TrialTrainingFormData,
} from './schemas/registration.schema';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

export class ValidationService {
  /**
   * Validate personal information
   */
  static validatePersonalInfo(data: unknown): ValidationResult<PersonalInfoFormData> {
    try {
      const validatedData = personalInfoSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate address information
   */
  static validateAddress(data: unknown): ValidationResult<AddressFormData> {
    try {
      const validatedData = addressSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate tennis information
   */
  static validateTennisInfo(data: unknown): ValidationResult<TennisInfoFormData> {
    try {
      const validatedData = tennisInfoSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate additional information
   */
  static validateAdditionalInfo(data: unknown): ValidationResult<AdditionalInfoFormData> {
    try {
      const validatedData = additionalInfoSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate agreement information
   */
  static validateAgreement(data: unknown): ValidationResult<AgreementFormData> {
    try {
      const validatedData = agreementSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate complete registration
   */
  static validateRegistration(data: unknown): ValidationResult<RegistrationFormData> {
    try {
      const validatedData = registrationSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate application
   */
  static validateApplication(data: unknown): ValidationResult<ApplicationFormData> {
    try {
      const validatedData = applicationSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate booking
   */
  static validateBooking(data: unknown): ValidationResult<BookingFormData> {
    try {
      const validatedData = bookingSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate cancellation
   */
  static validateCancellation(data: unknown): ValidationResult<CancellationFormData> {
    try {
      const validatedData = cancellationSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate status update
   */
  static validateStatusUpdate(data: unknown): ValidationResult<StatusUpdateFormData> {
    try {
      const validatedData = statusUpdateSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate profile update
   */
  static validateProfileUpdate(data: unknown): ValidationResult<ProfileUpdateFormData> {
    try {
      const validatedData = profileUpdateSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate group change request
   */
  static validateGroupChangeRequest(data: unknown): ValidationResult<GroupChangeRequestFormData> {
    try {
      const validatedData = groupChangeRequestSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate SEPA mandate
   */
  static validateSepaMandate(data: unknown): ValidationResult<SepaMandateFormData> {
    try {
      const validatedData = sepaMandateSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Validate trial training registration
   */
  static validateTrialTraining(data: unknown): ValidationResult<TrialTrainingFormData> {
    try {
      const validatedData = trialTrainingSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        return { success: false, errors };
      }
      return { success: false, errors: { general: 'Validierungsfehler' } };
    }
  }

  /**
   * Format Zod errors into a user-friendly format
   */
  private static formatZodErrors(error: z.ZodError): Record<string, string> {
    const errors: Record<string, string> = {};

    error.errors.forEach((err) => {
      const path = err.path.join('.');
      errors[path] = err.message;
    });

    return errors;
  }

  /**
   * Get first error message from validation result
   */
  static getFirstError(result: ValidationResult<unknown>): string | null {
    if (result.success || !result.errors) {
      return null;
    }

    const firstKey = Object.keys(result.errors)[0];
    return firstKey ? result.errors[firstKey] : null;
  }

  /**
   * Get all error messages from validation result
   */
  static getAllErrors(result: ValidationResult<unknown>): string[] {
    if (result.success || !result.errors) {
      return [];
    }

    return Object.values(result.errors);
  }

  /**
   * Check if validation was successful
   */
  static isValid(
    result: ValidationResult<unknown>
  ): result is ValidationResult<any> & { success: true } {
    return result.success === true;
  }
}
