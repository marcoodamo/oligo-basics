export type FieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'select'
    | 'checkbox'
    | 'email'
    | 'phone'
    | 'single_choice'
    | 'multiple_choice';

export interface FormField {
    id: string;
    type: FieldType;
    label: string;
    /** Descrição da pergunta (texto menor, explicativo) */
    fieldDescription?: string;
    columnName?: string;
    required: boolean;
    placeholder?: string;
    options?: string[]; // For select/checkbox
    allowOther?: boolean; // For single_choice and multiple_choice - allows "other" option with free text
    order: number;
}

export type ThankYouActionType = 'TEXT' | 'REDIRECT' | 'CODE';

export interface FormSettings {
    emailNotifications?: boolean;
    notifyEmail?: string;
    thankYouAction?: ThankYouActionType;
    thankYouTitle?: string;
    thankYouMessage?: string;
    redirectUrl?: string;
    thankYouCode?: string;
    allowResubmission?: boolean;
    /** URL da imagem de fundo do formulário público (exibida escurecida/opaca) */
    backgroundImageUrl?: string;
    /** Página de apresentação antes da primeira pergunta */
    introTitle?: string;
    introSubtitle?: string;
    introText?: string;
}

export interface Form {
    id: string;
    title: string;
    description: string | null;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    publicSlug: string;
    organizationId: string;
    fields: FormField[];
    settings: FormSettings | null;
    emailNotifications: boolean;
    notifyEmail: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Submission {
    id: string;
    formId: string;
    data: Record<string, any>;
    createdAt: Date;
}
