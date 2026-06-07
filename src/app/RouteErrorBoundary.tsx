import { Component, useEffect, type ReactNode } from 'react';
import { Link, useLocation, useRouteError } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';

type RouteErrorBoundaryMode = 'default' | 'public';

function RouteErrorView({ mode }: { mode: RouteErrorBoundaryMode }) {
  const isPublicRoute = mode === 'public';

  return (
    <div className="page-shell py-16">
      <EmptyState
        title={isPublicRoute ? '공개 화면을 다시 불러오지 못했습니다' : '화면을 다시 불러오지 못했습니다'}
        description={
          isPublicRoute
            ? '최신 배포로 바뀌는 동안 공개 자산이나 공개 데이터가 어긋났을 수 있습니다. 새로고침 후 다시 시도해 주세요.'
            : '화면 자산을 불러오는 중 문제가 발생했습니다. 새로고침 후 다시 시도해 주세요.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
              type="button"
            >
              새로고침
            </button>
            <Link className="btn-secondary" to={isPublicRoute ? '/' : '/dashboard'}>
              {isPublicRoute ? '홈으로 이동' : '대시보드로 이동'}
            </Link>
          </div>
        }
      />
    </div>
  );
}

class RouteErrorBoundaryInner extends Component<
  {
    children: ReactNode;
    mode: RouteErrorBoundaryMode;
    resetKey: string;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[route-error-boundary] route render failed', {
      error,
      mode: this.props.mode,
      resetKey: this.props.resetKey,
    });
  }

  componentDidUpdate(previousProps: Readonly<{ resetKey: string }>) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return <RouteErrorView mode={this.props.mode} />;
  }
}

export function RouteErrorElement({ mode = 'default' }: { mode?: RouteErrorBoundaryMode }) {
  const error = useRouteError();
  const location = useLocation();

  useEffect(() => {
    console.error('[route-error-element] route failed', {
      error,
      mode,
      resetKey: `${location.pathname}${location.search}`,
    });
  }, [error, location.pathname, location.search, mode]);

  return <RouteErrorView mode={mode} />;
}

export function RouteErrorBoundary({
  children,
  mode = 'default',
}: {
  children: ReactNode;
  mode?: RouteErrorBoundaryMode;
}) {
  const location = useLocation();

  return (
    <RouteErrorBoundaryInner
      mode={mode}
      resetKey={`${location.pathname}${location.search}`}
    >
      {children}
    </RouteErrorBoundaryInner>
  );
}
