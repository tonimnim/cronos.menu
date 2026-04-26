import { createClient } from "@/lib/supabase/server";
import "server-only";

export type CurrentStaff = {
  userId: string;
  /** Null for owners (they sign up with email); always set for waiters. */
  phone: string | null;
  email: string | null;
  displayName: string | null;
  role: "owner" | "staff" | "admin";
  restaurantId: string;
  restaurantName: string;
};

/**
 * Resolve the authenticated staff member + their restaurant in one round trip.
 * Returns null if no session, or if the session's user is not linked to any
 * restaurant (stale session after owner-removed staff).
 */
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const { data: staff, error } = await supabase
    .from("staff_users")
    .select(
      "user_id, phone, email, display_name, role, restaurant_id, restaurants ( id, name )",
    )
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error || !staff) return null;

  const restaurant = Array.isArray(staff.restaurants)
    ? staff.restaurants[0]
    : staff.restaurants;
  if (!restaurant) return null;

  return {
    userId: staff.user_id,
    phone: staff.phone,
    email: staff.email,
    displayName: staff.display_name,
    role: staff.role,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
  };
}
