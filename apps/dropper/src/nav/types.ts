/**
 * Auth stack — login lives here, replaced by the main tabs once a session
 * exists.
 *
 * Main app uses bottom tabs. Each tab can host its own nested stack.
 */
export type AuthStackParamList = {
  Login: undefined;
  EnterInviteCode: undefined;
  AcceptInvite: { token: string };
};

export type JobsStackParamList = {
  JobsHome: undefined;
  JobDetail: { assignmentId: string };
  Active: { assignmentId: string };
  Summary: { assignmentId: string };
};

export type AppTabParamList = {
  Jobs: undefined;
  AllJobs: undefined;
  Profile: undefined;
};

/** Backwards-compat alias for the original flat type used inside screens. */
export type RootStackParamList = JobsStackParamList & AppTabParamList;
