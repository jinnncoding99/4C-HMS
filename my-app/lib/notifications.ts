import { createClient } from "@/lib/supabase/client";

export const sendNotification = async (type: string, email: string, message: string) => {
  const supabase = createClient();
  
  const { error } = await supabase.from('notifications').insert([
    {
      type: type, // 'registration', 'payment', 'vacation'
      email: email,
      message: message,
      is_read: false
    }
  ]);

  if (error) console.error("Error sending notification:", error);
};