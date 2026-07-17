import type { SubTask } from "@realtalk-ai/core";

function formatSubTaskName(name: string): string {
  return name.replace(/_/g, " ");
}

export function SubTasksBadge({
  subTasks,
}: {
  subTasks: SubTask[];
}): JSX.Element {
  const totalCount = subTasks.length;
  const completedCount = subTasks.filter(
    (subTask) => subTask.status === "completed",
  ).length;
  const allDone = completedCount === totalCount;

  const taskWord = totalCount === 1 ? "task" : "tasks";
  const allDoneLabel = `${totalCount} ${taskWord} completed`;
  const progressLabel = `${completedCount}/${totalCount} tasks`;
  const label = allDone ? allDoneLabel : progressLabel;

  return (
    <div className="subtasks">
      <div
        className={`subtasks-badge ${allDone ? "completed" : "pending"}`}
        aria-label={label}
      >
        <span className="subtask-indicator" aria-hidden="true">
          {allDone ? (
            <span className="subtask-check" />
          ) : (
            <span className="subtask-spinner" />
          )}
        </span>
        {label}
      </div>
      <div className="subtasks-details" role="tooltip">
        {subTasks.map((subTask) => {
          const pending = subTask.status === "pending";
          return (
            <div
              key={subTask.id}
              className={`subtask ${subTask.status}`}
              aria-label={`${subTask.name}: ${subTask.status}`}
            >
              <span className="subtask-indicator" aria-hidden="true">
                {pending ? (
                  <span className="subtask-spinner" />
                ) : (
                  <span className="subtask-check" />
                )}
              </span>
              <span className="subtask-label">
                {formatSubTaskName(subTask.name)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
