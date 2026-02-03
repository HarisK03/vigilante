import { createClient, SupabaseClient } from "@/lib/supabase/server-client";
export enum UserTier {
    TIER3 = "authority",
    TIER2 = "admin",
    TIER1 = "regular_user"
}

export enum RequestStatus {
    PENDING = "pending",
    APPROVED = "approved",
    DENIED = "denied",
    CANCELLED = "cancelled"
}

export interface ApprovalResponse {
    approved: boolean;
    message: string;
}

export interface AuthorizationCheck {
    isAuthorized: boolean;
    reason?: string;
}

export class AuthorizationEngine {
    private supabase: SupabaseClient;

    constructor(supabaseUrl: string, supabaseKey: string) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async canReviewRequests(userId: string): Promise<boolean> {
        const { data, error } = await this.supabase
            .from('user_profiles')
            .select('tier')
            .eq('id', userId)
            .single();

        if (error) {
            throw new Error(`Failed to fetch user: ${error.message}`);
        }

        return data.tier === UserTier.TIER3;
    }

    async checkReviewAuthorization(reviewerId: string, requestId: string): Promise<AuthorizationCheck> {
        const hasRole = await this.canReviewRequests(reviewerId);
        if (!hasRole) {
            return {
            isAuthorized: false,
            reason: 'User does not have authorization permissions'
            };
        }
        const { data, error } = await this.supabase
            .from('requests')
            .select('requester_id, status')
            .eq('id', requestId)
            .single();

        if (error) {
            return {
                isAuthorized: false,
                reason: `Failed to fetch request: ${error.message}`
            };
        }
    }

}