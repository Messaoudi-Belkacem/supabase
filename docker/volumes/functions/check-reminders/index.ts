import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Starting reminder check at:', new Date().toISOString());
    // Récupérer tous les workflows actifs
    const { data: workflows, error: workflowError } = await supabase.from('reminder_workflows').select(`
        *,
        workflow_steps (
          *,
          email_templates (*)
        )
      `).eq('is_active', true);
    if (workflowError) {
      throw workflowError;
    }
    if (!workflows || workflows.length === 0) {
      console.log('No active workflows found');
      return new Response(JSON.stringify({
        message: 'No active workflows',
        processed: 0,
        queued: 0
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    let totalProcessed = 0;
    let totalQueued = 0;
    let alreadySent = 0;
    let alreadyInQueue = 0;
    // Pour chaque workflow
    for (const workflow of workflows){
      console.log('Processing workflow:', workflow.name);
      if (!workflow.workflow_steps || workflow.workflow_steps.length === 0) {
        console.log(`Workflow ${workflow.name} has no steps, skipping`);
        continue;
      }
      // Trier les étapes par ordre
      const steps = workflow.workflow_steps.sort((a, b)=>a.step_order - b.step_order);
      // Récupérer les abonnements assignés à ce workflow
      const { data: subscriptions, error: subError } = await supabase.from('subscriptions').select('*').eq('assigned_workflow_id', workflow.id).eq('status', 'active').eq('workflow_paused', false);
      if (subError) {
        console.error('Error fetching subscriptions for workflow:', subError);
        continue;
      }
      if (!subscriptions || subscriptions.length === 0) {
        console.log(`No active subscriptions for workflow ${workflow.name}`);
        continue;
      }
      console.log(`Found ${subscriptions.length} subscriptions assigned to workflow ${workflow.name}`);
      // Pour chaque abonnement assigné au workflow
      for (const subscription of subscriptions){
        totalProcessed++;
        // Déterminer quelle étape doit être envoyée
        const today = new Date();
        const endDate = new Date(subscription.end_date);
        const daysUntilExpiry = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        // Trouver la bonne étape basée sur les jours avant expiration
        let stepToSend = null;
        for (const step of steps){
          if (daysUntilExpiry <= step.days_before_expiry) {
            stepToSend = step;
            break;
          }
        }
        if (!stepToSend) {
          continue;
        }
        // Vérifier si cette étape a déjà été envoyée pour cet abonnement
        const { data: existingHistory } = await supabase.from('reminder_history').select('id').eq('subscription_id', subscription.id).eq('workflow_id', workflow.id).eq('step_id', stepToSend.id).maybeSingle();
        if (existingHistory) {
          alreadySent++;
          continue;
        }
        // Vérifier si l'email n'est pas déjà en queue
        const { data: existingQueue } = await supabase.from('email_queue').select('id').eq('subscription_id', subscription.id).in('status', [
          'pending',
          'processing'
        ]).maybeSingle();
        if (existingQueue) {
          alreadyInQueue++;
          continue;
        }
        // Si stop_on_reply est activé, vérifier si le client a répondu
        if (workflow.stop_on_reply) {
          const { data: replies } = await supabase.from('reminder_history').select('id').eq('subscription_id', subscription.id).eq('workflow_id', workflow.id).eq('reply_received', true).limit(1);
          if (replies && replies.length > 0) {
            console.log(`Client has replied, stopping workflow for ${subscription.subscription_code}`);
            continue;
          }
        }
        // Préparer le contenu de l'email
        const template = stepToSend.email_templates;
        if (!template) {
          console.log(`No template found for step ${stepToSend.id}`);
          continue;
        }
        // Remplacer les variables dans le sujet et le corps
        let subject = template.subject;
        let body = template.body;
        // Variables de remplacement
        const variables = {
          '{{subscription_code}}': subscription.subscription_code || '',
          '{{email}}': subscription.email || '',
          '{{end_date}}': subscription.end_date || '',
          '{{subject}}': subscription.subject || '',
          '{{start_date}}': subscription.start_date || '',
          '{{duration_months}}': String(subscription.duration_months || '')
        };
        for (const [key, value] of Object.entries(variables)){
          subject = subject.replace(new RegExp(key, 'g'), value);
          body = body.replace(new RegExp(key, 'g'), value);
        }
        // Ajouter à la queue - TOUJOURS, sans limite
        // La limite s'applique à l'envoi (process-email-queue), pas à la mise en queue
        const { error: insertError } = await supabase.from('email_queue').insert({
          subscription_id: subscription.id,
          subject,
          body,
          priority: 100 - daysUntilExpiry,
          status: 'pending'
        });
        if (insertError) {
          console.error(`Error queuing email for ${subscription.subscription_code}:`, insertError);
        } else {
          totalQueued++;
          console.log(`Queued reminder for ${subscription.subscription_code} (step ${stepToSend.step_order}, ${daysUntilExpiry} days until expiry)`);
        }
      }
    }
    // Compter les emails en queue
    const { count: pendingCount } = await supabase.from('email_queue').select('*', {
      count: 'exact',
      head: true
    }).eq('status', 'pending');
    console.log(`Reminder check completed. Processed: ${totalProcessed}, Queued: ${totalQueued}, Already sent: ${alreadySent}, Already in queue: ${alreadyInQueue}`);
    return new Response(JSON.stringify({
      message: 'Reminder check completed',
      processed: totalProcessed,
      queued: totalQueued,
      alreadySent,
      alreadyInQueue,
      totalPending: pendingCount || 0,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in check-reminders function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
