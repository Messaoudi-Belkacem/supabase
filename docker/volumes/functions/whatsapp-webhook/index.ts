import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'lovable_whatsapp_verify';
  try {
    // GET request - WhatsApp webhook verification
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      console.log('Webhook verification request:', {
        mode,
        token,
        challenge
      });
      if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
        console.log('Webhook verified successfully');
        return new Response(challenge, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain'
          }
        });
      } else {
        console.error('Webhook verification failed');
        return new Response('Forbidden', {
          status: 403,
          headers: corsHeaders
        });
      }
    }
    // POST request - Incoming messages
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Received webhook payload:', JSON.stringify(body, null, 2));
      // Process WhatsApp Cloud API webhook
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []){
          for (const change of entry.changes || []){
            if (change.field === 'messages') {
              const value = change.value;
              const messages = value.messages || [];
              for (const message of messages){
                const fromPhone = message.from;
                const messageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
                let content = '';
                let messageType = message.type || 'text';
                let mediaUrl = null;
                // Extract message content based on type
                if (message.text) {
                  content = message.text.body;
                } else if (message.image) {
                  messageType = 'image';
                  content = message.image.caption || '[Image]';
                  mediaUrl = message.image.id; // Media ID to fetch later
                } else if (message.document) {
                  messageType = 'document';
                  content = message.document.filename || '[Document]';
                  mediaUrl = message.document.id;
                } else if (message.audio) {
                  messageType = 'audio';
                  content = '[Audio message]';
                  mediaUrl = message.audio.id;
                } else if (message.video) {
                  messageType = 'video';
                  content = message.video.caption || '[Video]';
                  mediaUrl = message.video.id;
                }
                console.log(`Processing message from ${fromPhone}: ${content}`);
                // Try to find matching subscription by phone number
                const { data: subscription } = await supabase.from('subscriptions').select('id').eq('phone_number', fromPhone).maybeSingle();
                let subscriptionId = subscription?.id || null;
                let whatsappContactId = null;
                // If no subscription match, check/create whatsapp_contacts
                if (!subscriptionId) {
                  // Check if contact already exists
                  const { data: existingContact } = await supabase.from('whatsapp_contacts').select('id, linked_subscription_id').eq('phone_number', fromPhone).maybeSingle();
                  if (existingContact) {
                    whatsappContactId = existingContact.id;
                    subscriptionId = existingContact.linked_subscription_id;
                  } else {
                    // Create new pending contact
                    const contactName = value.contacts?.[0]?.profile?.name || null;
                    const { data: newContact, error: contactError } = await supabase.from('whatsapp_contacts').insert({
                      phone_number: fromPhone,
                      name: contactName,
                      status: 'pending'
                    }).select('id').single();
                    if (contactError) {
                      console.error('Error creating contact:', contactError);
                    } else {
                      whatsappContactId = newContact.id;
                      console.log(`Created new pending contact for ${fromPhone}`);
                    }
                  }
                }
                // Store the message
                const { error: messageError } = await supabase.from('whatsapp_messages').insert({
                  whatsapp_message_id: messageId,
                  from_phone: fromPhone,
                  direction: 'inbound',
                  message_type: messageType,
                  content: content,
                  media_url: mediaUrl,
                  subscription_id: subscriptionId,
                  whatsapp_contact_id: whatsappContactId,
                  status: 'received',
                  received_at: timestamp
                });
                if (messageError) {
                  console.error('Error storing message:', messageError);
                } else {
                  console.log(`Message stored successfully for ${fromPhone}`);
                }
              }
              // Handle status updates
              const statuses = value.statuses || [];
              for (const status of statuses){
                console.log(`Message ${status.id} status: ${status.status}`);
                // Update message status if needed
                await supabase.from('whatsapp_messages').update({
                  status: status.status
                }).eq('whatsapp_message_id', status.id);
              }
            }
          }
        }
      }
      return new Response(JSON.stringify({
        success: true
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
