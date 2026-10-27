import { supabase } from "./supabase.js";

export async function getNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, created_at, read_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function markNotificationRead(notificationId) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export function renderNotifications(container, notifications) {
  container.replaceChildren();

  if (!notifications.length) {
    container.textContent = "No notifications available.";
    return;
  }

  notifications.forEach(notification => {
    const article = document.createElement("article");
    const heading = document.createElement("h3");
    const body = document.createElement("p");
    const time = document.createElement("small");

    heading.textContent = notification.title;
    body.textContent = notification.body;
    time.textContent = new Date(
      notification.created_at
    ).toLocaleString();

    article.append(heading, body, time);

    if (!notification.read_at) {
      const button = document.createElement("button");
      button.textContent = "Mark as read";

      button.addEventListener("click", async () => {
        try {
          await markNotificationRead(notification.id);
          article.remove();
        } catch {
          alert("Could not update this notification.");
        }
      });

      article.appendChild(button);
    }

    container.appendChild(article);
  });
}