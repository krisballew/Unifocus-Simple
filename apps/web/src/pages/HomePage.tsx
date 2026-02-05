import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { getCurrentUser } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

export function HomePage(): React.ReactElement {
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
  });

  if (currentUserQuery.isLoading) {
    return <LoadingSkeleton lines={6} card />;
  }

  return (
    <div className="dashboard">
      <section className="dashboard-header">
        <div>
          <h2>Overview</h2>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-main">
          <div className="overview-cards">
            <div className="stat-card stat-card--blue">
              <span className="stat-icon stat-icon--blue" aria-hidden="true" />
              <p>Staff Active Today</p>
              <h3>72</h3>
              <button type="button">View Details</button>
            </div>
            <div className="stat-card stat-card--orange">
              <span className="stat-icon stat-icon--orange" aria-hidden="true" />
              <p>Employees Late</p>
              <h3>5</h3>
              <button type="button">View Details</button>
            </div>
            <div className="stat-card stat-card--green">
              <span className="stat-icon stat-icon--green" aria-hidden="true" />
              <p>Open Jobs</p>
              <h3>12</h3>
              <button type="button">View Jobs</button>
            </div>
            <div className="stat-card stat-card--red">
              <span className="stat-icon stat-icon--red" aria-hidden="true" />
              <p>Maintenance Issues</p>
              <h3>3</h3>
              <button type="button">View Issues</button>
            </div>
          </div>

          <div className="dashboard-row">
            <div className="dashboard-card">
              <div className="card-header">
                <h3>Attendance Status</h3>
              </div>
              <div className="attendance">
                <div className="donut" aria-hidden="true" />
                <div className="attendance-legend">
                  <div>
                    <span className="dot dot--blue" /> On Time <strong>68%</strong>
                  </div>
                  <div>
                    <span className="dot dot--red" /> Late <strong>14%</strong>
                  </div>
                  <div>
                    <span className="dot dot--yellow" /> Absent <strong>12%</strong>
                  </div>
                  <div>
                    <span className="dot dot--green" /> On Break <strong>6%</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <h3>Upcoming Shifts</h3>
              </div>
              <div className="shift-list">
                <div className="shift-item">
                  <div className="avatar">JT</div>
                  <div>
                    <p>John T.</p>
                    <span>9:00 AM - 5:00 PM</span>
                  </div>
                  <span className="badge badge--danger">Late</span>
                </div>
                <div className="shift-item">
                  <div className="avatar">SM</div>
                  <div>
                    <p>Sara M.</p>
                    <span>12:00 PM - 8:00 PM</span>
                  </div>
                  <span className="badge badge--success">On Shift</span>
                </div>
                <div className="shift-item">
                  <div className="avatar">MD</div>
                  <div>
                    <p>Mike D.</p>
                    <span>3:00 PM - 11:00 PM</span>
                  </div>
                  <span className="badge badge--info">Starts Soon</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-header">
              <h3>Property Alerts</h3>
            </div>
            <div className="alert-list">
              <div className="alert-item">
                <span className="dot dot--red" />
                <div>
                  <p>HVAC System Malfunction</p>
                  <span>Urgent · Building A</span>
                </div>
                <button type="button" className="link-button">
                  Assign Repair
                </button>
              </div>
              <div className="alert-item">
                <span className="dot dot--orange" />
                <div>
                  <p>Security Alarm Issue</p>
                  <span>Alert · Parking Lot</span>
                </div>
                <button type="button" className="link-button">
                  Check Status
                </button>
              </div>
              <div className="alert-item">
                <span className="dot dot--green" />
                <div>
                  <p>Landscaping Delay</p>
                  <span>Info · Courtyard</span>
                </div>
                <button type="button" className="link-button">
                  Reschedule
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="dashboard-side">
          <div className="dashboard-card">
            <div className="card-header">
              <h3>Recommended Actions</h3>
            </div>
            <div className="action-list">
              <div className="action-item">
                <span className="dot dot--red" />
                <div>
                  <p>2 Employees Didn’t Clock In</p>
                  <span>Send reminder</span>
                </div>
                <button type="button" className="small-button">
                  Send
                </button>
              </div>
              <div className="action-item">
                <span className="dot dot--orange" />
                <div>
                  <p>Shift Coverage Needed</p>
                  <span>Find replacement</span>
                </div>
                <button type="button" className="small-button">
                  Find
                </button>
              </div>
              <div className="action-item">
                <span className="dot dot--red" />
                <div>
                  <p>3 Jobs Overdue</p>
                  <span>Review queue</span>
                </div>
                <button type="button" className="small-button">
                  Review
                </button>
              </div>
              <div className="action-item">
                <span className="dot dot--green" />
                <div>
                  <p>Property Inspection Due</p>
                  <span>Schedule now</span>
                </div>
                <button type="button" className="small-button">
                  Schedule
                </button>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-header">
              <h3>Job Performance</h3>
            </div>
            <div className="job-performance">
              <div className="donut donut--small" aria-hidden="true" />
              <div className="performance-stats">
                <div>
                  <span>In Progress</span>
                  <strong>8</strong>
                </div>
                <div>
                  <span>Pending</span>
                  <strong>4</strong>
                </div>
                <div>
                  <span>Completed</span>
                  <strong>28</strong>
                </div>
              </div>
              <div className="bar-chart" aria-hidden="true">
                <div className="bar" style={{ height: '40%' }} />
                <div className="bar" style={{ height: '55%' }} />
                <div className="bar" style={{ height: '30%' }} />
                <div className="bar" style={{ height: '75%' }} />
                <div className="bar" style={{ height: '60%' }} />
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
